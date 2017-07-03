const neo4j = require('neo4j-driver').v1;
const Readable = require('stream').Readable;
const EventEmitter = require('events').EventEmitter;
const through2 = require('through2');
module.exports = (conf, type) => {
  const db = neo4j.driver(conf.url || "bolt://localhost", neo4j.auth.basic(conf.username || "neo4j", conf.password || "password"));
  const list = `MATCH (n:Artifact { type:'${type}', status:'completed' }) RETURN n ORDER BY n.groupId, n.artifactId, n.version`
  const merge =
  'MERGE (source:Artifact {artifactId:{source}.artifactId, groupId:{source}.groupId, version:{source}.version, type:{source}.type}) ' +
  'MERGE (target:Artifact {artifactId:{target}.artifactId, groupId:{target}.groupId, version:{target}.version, type:{source}.type}) ' +
  'MERGE (source)-[:DEPENDS_ON]->(target)'
  const update =
  "MERGE (artifact:Artifact {artifactId:{artifact}.artifactId, groupId:{artifact}.groupId, version:{artifact}.version, type:{artifact}.type}) " +
  "SET artifact.status={artifact}.status"
  commands = {
    'dependency': merge,
    'artifact': update
  }
  return {
    artifacts: () => {
      var session = db.session();
      var stream = new Readable({objectMode: true});
      stream._read = () => {};
      session.run(list).subscribe({
        onNext: function(record) {
          stream.push(record._fields[0].properties);
        },
        onCompleted: function () {
          stream.push(null);
          session.close();
        },
        onError: function(error) {
          console.log(error);
          stream.push(null);
          session.close();
        }
      });
      return stream;
    },
    updates: () => {
      var session = db.session()
      return through2.obj( function(data, enc, cb) {
        this.push(data)
        var command = commands[data.type];
        session
          .run(command, data)
          .catch(function(err) {
            console.error(err)
            cb()
          })
          .then(function(result) {
            cb()
          })
      }, () => {
        session.close()
        db.close();
      })
    }
  }
}
