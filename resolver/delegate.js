const spawn = require('child_process').spawn;
const json = require('json-stream');
module.exports = (command) => {
  var consumer;
  var child = spawn(command);
  console.log("Spawned child", child.pid);
  child.stdout.pipe(json()).on('data', (data) => consumer(data));
  var result = function (data, enc, cb) {
    consumer = (result) => {
      this.push(result);
      if(result.status === 'complete') {
        cb();
      }
    }
    child.stdin.write(JSON.stringify(data)+'\n')
  };
  result.destroy = () => {
    console.log("Terminating child", child.pid);
    child.kill();
  }
  return result;
}
