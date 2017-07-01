const fs = require('fs');
const json = require('json-stream');
module.exports = () => {
  return {
    artifacts: () => fs.createReadStream('./test/repository.txt').pipe(json())
  }
}
