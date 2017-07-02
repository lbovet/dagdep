const fs = require('fs');
const map = require('through2-map');
const json = require('JSONStream');
module.exports = (conf, resolver) => {
  return {
    artifacts: () => fs.createReadStream('./test/repository.json')
      .pipe(json.parse('results.*'))
      .pipe(map.obj( x => {
        return { id: resolver.id(x) }
      }))
  }
}
