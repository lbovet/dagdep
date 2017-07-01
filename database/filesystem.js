const fs = require('fs');
const through2 = require('through2');
const json = require('json-stream');
module.exports = () => {
  return {
    artifacts: () => fs.createReadStream('./test/database.txt').pipe(json()),
    updates: () => through2.obj((data, enc, cb) => {
      process.stdout.write(JSON.stringify(data)+"\n");
      cb();
    })
  }
}
