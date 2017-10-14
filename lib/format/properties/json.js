var PropertiesFile = require('java-properties').PropertiesFile;
var path = require('path');
module.exports = function (source) {
  if (this.cacheable) {
    this.cacheable();
  }

  var result = {};
  extract(this.resourcePath, result);
  
  this.value = JSON.stringify(result, undefined, "\t");

  return "module.exports = " + JSON.stringify(this.value);
};


function extract(resourcePath, result){
  var props = new PropertiesFile(resourcePath);

  props.getKeys().forEach(function (key) {
    var keys = key.split('.');
    keys.reduce(function (p, v, i) {
      p[v] = (i < keys.length - 1) ? p[v] || {} : props.get(key);
      return p[v];
    }, result);
  });
}

function extractByNest(resourcePath, result){
  var props = new PropertiesFile(resourcePath);

  props.getKeys().forEach(function (key) {
    if(key === '@import'){
      extract(path.resolve(resourcePath.substr(0, resourcePath.lastIndexOf(path.seq)), props.get(key)), result)
    }else{
      var keys = key.split('.');
      keys.reduce(function (p, v, i) {
        p[v] = (i < keys.length - 1) ? p[v] || {} : props.get(key);
        return p[v];
      }, result);
    }
  });
}
