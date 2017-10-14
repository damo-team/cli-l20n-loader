var p = require('path');
var fs = require('fs');
var mkdirp = require('mkdirp');
var writeFileSync = fs.writeFileSync;
var mkdirpSync = mkdirp.sync;

function L20nPlugin(option) {
    this.$option_ = option;
    global.l20n = {};
    global.l20nReverse = {};
}

L20nPlugin.prototype.apply = function (compiler) {
    var option = this.$option_;
    var messages = {};

    compiler.plugin("compilation", function (compilation) {
        // console.log("The compiler is starting a new compilation...");

        compilation.plugin("normal-module-loader", function (context, module) {
            // console.log("registering function: ", __dirname, "in loader context");
            context["metadataL20nPlugin"] = function (metadata) {
                // do something with metadata and module
                // console.log("module:",module,"collecting metadata:", metadata);
                messages[module.resource] = metadata["l20n"];
            };
        });
    });

    compiler.plugin('emit', function (compilation, callback) {
        // console.log("emitting messages");

        // check for duplicates and flatten
        
        global.l20n = {};
        Object.keys(messages).map(function (e) {
            Object.assign(global.l20n, messages[e]);
        });

        if(option.filename){
            var filename = p.resolve(option.filename);
            var messagesMap = global.l20n;
            global.l20n = {};
            global.messageMap = global.l20nReverse;
            Object.keys(messagesMap).sort().map(key => {
                global.l20n[key] = messagesMap[key];
                global.messageMap[messagesMap[key]] = key;
            });
            messagesMap = {};

            var messagesFile = JSON.stringify(global.l20n, null, 2);

            if (!fs.existsSync(filename)) {
                mkdirpSync(p.dirname(filename));
            }
            
            // http://www.jianshu.com/p/8c04fb552c6f
            writeFileSync(filename, '\uFEFF' + messagesFile, 'utf8');
        }

        callback();
    });
};

module.exports = L20nPlugin;
module.exports.metadataContextFunctionName = "metadataL20nPlugin";