const delegate = require('./delegate.js');
module.exports = (conf, repoConf) => {
  const pathPattern = /(.*)\/(.*)\/(.*)/
  const artifactPattern = /(.*):(.*):(.*)/
  return {
    resolve: () => delegate('gradle.bat', ['-b', 'resolver/build.gradle', '-q', `-Drepository=${repoConf.url}/${repoConf.context}`]),
    id: entry => {
      var tokens = pathPattern.exec(entry.path);
      return tokens[1].replace(/\//g,'.')+':'+tokens[2]+':'+tokens[3];
    },
    parse: id => {
      var tokens = artifactPattern.exec(id);
      return {
        groupId: tokens[1],
        artifactId: tokens[2],
        version: tokens[3]
      }
    },
    format: artifact => artifact.groupId+":"+artifact.artifactId+":"+artifact.version,
    type: "pom"
  }
}
