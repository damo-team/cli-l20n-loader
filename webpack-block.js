var ExtractTextPlugin = require('damo-cli-extract-plugin');
var path = require('path');
var filters = require('./lib/filter');
var L20nPlugin = require('./babel-l20n-plugin');

module.exports = function l20nWebpckBlock(newWebPackConfig, locals, version) {
  var default_locale = locals['default'] || 'zh-CN';
  var l20nMetas = [];

  if (!locals.available) {
    var available = locals.available = [default_locale + ':' + version];
  } else {
    var available = locals.available.map(function(lang) {
      return lang + ':' + version;
    });
  }
  l20nMetas.push('l20n!availableLanguages=' + available);
  l20nMetas.push('l20n!defaultLanguage=' + default_locale);
  l20nMetas.push('l20n!appVersion=' + version);
  var formAndTo = ['properties', 'json'];
  formAndTo[0] = locals.form || formAndTo[0];
  formAndTo[1] = locals.to || formAndTo[1];
  var assetPath = newWebPackConfig[0].output.path;
  var prePath = newWebPackConfig[0].output.filename.substr(0, newWebPackConfig[0].output.filename.lastIndexOf('/') + 1) + 'locals/chunks/';

  var langExtractTextPlugin = new ExtractTextPlugin(default_locale, prePath + '/locals/' + default_locale + '.' + formAndTo[1], {
    dataFilter: filters[formAndTo[1] + 'Filter']
  });
  newWebPackConfig[0].plugins.unshift(langExtractTextPlugin);
  newWebPackConfig[0].module.loaders.push({
    test: new RegExp('\\.' + formAndTo[0] + '\$'),
    //提取json文件到内存，否则最终注入到js文件中
    loader: langExtractTextPlugin.extract("damo-cli-l20n-loader/lib/format/" + formAndTo[0] + '/' + formAndTo[1])
  });

  var loaders = newWebPackConfig[0].module.loaders;
  var jsLoader = [];
  for (var i = 0, len = loaders.length; i < len; i++) {
    if (loaders[i].test.toString().indexOf('.js') > -1) {
      jsLoader[0] = Object.assign({}, loaders[i]);
      if(loaders[i].query && loaders[i].query.plugins){
        loaders[i].query.cacheDirectory = !locals.nocache;
        loaders[i].query.plugins.push(['damo-cli-l20n-loader/babel-l20n-loader', {
          duplicate: !!locals.duplicate,
          filenames: locals.duplicateFileNames ? locals.duplicateFileNames.map(function(filename){ return path.join(assetPath, filename)}) : null
        }]);
        loaders[i].query.metadataSubscribers = [L20nPlugin.metadataContextFunctionName];
        newWebPackConfig[0].plugins.unshift(new L20nPlugin({
          filename: assetPath + '/locals/extract/' + default_locale + '.json'
        }));
      }
      break;
    }
  }
  // console.log(jsLoader[0].query.plugins)
  locals.available.forEach(function(lang) {
    if (lang === default_locale) return;
    (function(filename) {
      var langExtractTextPlugin = new ExtractTextPlugin(filename, prePath + '/locals/' + filename + '.' + formAndTo[1], {
        dataFilter: filters[formAndTo[1] + 'Filter']
      });
      // var prePath = assetPath.split('/').slice(0, -2).join('/') + '/chunks/';
      newWebPackConfig.push({
        name: filename,
        entry: newWebPackConfig[0].entry,
        output: {
          path: assetPath,
          publicPath: newWebPackConfig[0].output.publicPath,
          chunkFilename: prePath + '[name].js',
          filename: prePath + 'bundle.js'
        },
        module: {
          loaders: jsLoader.concat([{
            test: new RegExp('\\.' + formAndTo[0] + '\$'),
            loader: langExtractTextPlugin.extract("damo-cli-l20n-loader/lib/format/" + formAndTo[0] + '/' + formAndTo[1], {
              filename: filename
            })
          }])
        },
        plugins: [langExtractTextPlugin],
        resolveLoader: newWebPackConfig[0].resolveLoader
      })
    })(lang);
  });
  
  return l20nMetas;
}