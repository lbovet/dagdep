module.exports = () => {
  return {
    resolve: () => {
      var last;
      return (data, cb) => {
        if(last) {
          cb(null, { type: "dependency", "source": last, "target": data });
          cb(null, { type: "artifact", id: last.id, status: "complete" });
        }
        cb(null, null);
        last = data;
      }
    }
  }
}
