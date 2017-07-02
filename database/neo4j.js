var neo4j = require('neo4j-driver').v1;
var Readable = require('stream').Readable;
var EventEmitter = require('events').EventEmitter;
module.exports = (conf, type) => {
  const db = neo4j.driver(conf.url || "bolt://localhost", neo4j.auth.basic(conf.username || "neo4j", conf.password || "password")).db()
  const list = `MATCH (n:Artifact { type='${type}' }) RETURN n`
  const merge =
  'MERGE (source:Artifact {artifactId:{source}.artifactId, groupId:{source}.groupId, version:{source}.version}, type:{source}.type) ' +
  'MERGE (target:Artifact {artifactId:{target}.artifactId, groupId:{target}.groupId, version:{target}.version}, type:{source}.type) ' +
  'MERGE (source)-[:DEPENDS_ON{scope: {scope}}]->(target)'
  const update =
  "MATCH (artifact:Artifact {artifactId:{artifact}.artifactId, groupId:{artifact}.groupId, version:{artifact}.version}, type:{artifact}.type) " +
  "SET artifact.status={artifact}.status}"
  commands = {
    'dependency': merge,
    'artifact': update
  }
  return {
    artifacts: () => {
      var session = db.session();
      var stream = new Readable({objectMode: true});
      run(list).subscribe({
        onNext: function(record) {
          stream.push(record);
        },
        onCompleted: function () {
          stream.push(null);
        },
        onError: function(error) {
          console.log(error);
          stream.push(null);
        }
      });
      return stream;
    },
    updates: () => {
      var session = db.session()
      through2.obj((data, enc, cb) => {
        var command = commands(data.type);
        session
          .run(command, data)
          .catch(function(err) {
            console.error(err)
            cb()
          })
          .then(function(result) {
            cb()
          })
      })
    }
  }
}
