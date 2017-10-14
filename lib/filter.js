var flatten = require('flat');
var stringify = require('json-stable-stringify');

function DeepCopy(o, s){
  var t;
  for(var k in s){
    if(typeof o[k] === 'object' && typeof s[k] === 'object'){
      DeepCopy(o[k], s[k]);
    }else{
      o[k] = s[k];
    }
  }
  return o;
}

module.exports.jsonFilter = function jsonFilter(source){
  var sourceJson = global.l20n || {};
  if(source && source.children.length){
    source.children.forEach(function(child){
      try{
        DeepCopy(sourceJson, JSON.parse(child._value));
      }catch(e){
        throw e;
      }
    });
  }
  
  var child = source.children[0];
  child._value = stringify(flatten(sourceJson), {space: "\t"});
  source.children = [child];
  return source;
}

module.exports.propertiesFilter = function propertiesFilter(source){
  var sourceJson = {};
  if(source && source.children.length){
    source.children.forEach(function(child){
      try{
        DeepCopy(sourceJson, JSON.parse(child._value));
      }catch(e){
        throw e;
      }
    });
  }
  
  var sourceFlat = flatten(sourceJson);
  source = [];
  Object.keys(sourceFlat).sort().forEach(function(k){
    source.push(k + '=' + sourceFlat[k]);
  });
  
  var child = source.children[0];
  child._value = source.join("\n");
  source.children = [child];
  return source;
}

module.exports.l20nFilter = function l20nFilter(source){
  return source;
}

