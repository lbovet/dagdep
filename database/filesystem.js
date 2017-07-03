const fs = require('fs');
const through2 = require('through2');
const json = require('JSONStream');
module.exports = () => {
  return {
    artifacts: () => fs.createReadStream('./test/database.txt').pipe(json.parse()),
    updates: () => through2.obj(function(data, enc, cb) {
      process.stderr.write(JSON.stringify(data)+"\n");
      this.push(data);
      cb();
    })
  }
}
