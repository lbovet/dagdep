const fs = require('fs');
const through2 = require('through2');
const json = require('JSONStream');
module.exports = () => {
  return {
    artifacts: () => fs.createReadStream('./test/database.txt').pipe(json.parse()),
    updates: () => function(data, enc, cb) {
      this.push(data);
      cb();
    },
    close: () => {}
  }
}
