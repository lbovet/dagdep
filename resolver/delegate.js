const spawn = require('child_process').spawn;
const json = require('JSONStream');
const map = require('through2-map');
module.exports = (command, args) => {
  var consumer;
  var child = spawn(command, args);
  child.stdout
    .pipe(json.parse())
    .on('data', (data) => consumer(data));
  child.stderr.pipe(process.stderr);
  var result = function (data, enc, cb) {
    var d = data
    var self = this
    consumer = function(result) {
      self.push(result);
      if(result.type === 'artifact') {
        cb();
      }
    }
    child.stdin.write(JSON.stringify(data)+'\n')
  };
  result.destroy = () => {
    child.kill();
  }
  return result;
}
