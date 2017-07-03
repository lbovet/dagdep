const request = require('request');
const map = require('through2-map');
const json = require('JSONStream');
module.exports = (conf, resolver) => {
  if(conf.visit) {
    throw 'Visit context not yet implemented'
  }
  var options = {
    url: conf.url + '/api/search/aql',
    method: 'POST',
    headers: {
    'content-type': 'text/plain',
    },
    auth: {
      'user': conf.username,
      'pass': conf.password
    },
    body: `items.find({"repo":{"$eq":"${conf.context}"}},{"name":{"$match": "*.${resolver.type}"}}).include("path", "name")`
  };
  return {
    artifacts: () => { try{ return request(options)
      .pipe(json.parse('results.*'))
      .pipe(map.obj( x => {
        return { id: resolver.id(x) }
      }))
    } catch(e) {
      console.error(e)
    }
  }}
}
