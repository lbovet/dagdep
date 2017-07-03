const maven = require('./maven')();
module.exports = () => {
  var last;
  return {
    resolve: () => {
      return function (data, enc, cb) {
        self = this;
        setTimeout( () => {
          if(last) {
            this.push({ type: "dependency", "source": last, "target": data });
          }
          this.push({ type: "artifact", id: data.id, status: "complete" });
          cb();
          last = data;
        }, 20);
      };
    },
    id: maven.id,
    parse: maven.parse,
    format: maven.format,
    type: maven.type
  }
}
