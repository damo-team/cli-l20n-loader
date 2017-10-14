var p = require('path');
var fs = require('fs');

var FUNCTION_NAMES = ['defineMessage', 'pureMessage'];

var EXTRACTED = Symbol('L20nExtracted');
var MESSAGES = Symbol('L20nMessages');

var ATTRIBUTES = {
    global: [
        'title', 'aria-label', 'aria-valuetext', 'aria-moz-hint'
    ],
    a: ['download'],
    area: [
        'download', 'alt'
    ],
    // value is special-cased in isAttrAllowed
    input: [
        'alt', 'placeholder'
    ],
    menuitem: ['label'],
    menu: ['label'],
    optgroup: ['label'],
    option: ['label'],
    track: ['label'],
    img: ['alt'],
    textarea: ['placeholder'],
    th: ['abbr']
}
var attrsMap = {};
for (var key in ATTRIBUTES) {
    ATTRIBUTES[key]
        .forEach(function (v) {
            attrsMap[v] = true;
        })
}

module.exports = function (t) {
    var initMap = false;

    global.messageMap = {};
    global.messages = {};
    function getModuleSourceName(opts) {
        return opts.moduleSourceName || '@ali/aliyun-naza-l20n/dist/rc/l20n';
    }

    function storeMessage(discriptor, path, state) {
        var file = state.file;
        var id = discriptor.id;
        if (!id || !discriptor.message) {
            throw path.buildCodeFrameError('[L20n Error] Message Descriptors require an `id` and `message`.');
        }

        if (discriptor.attribute) {
            id += ':' + discriptor.attribute;
        }
        var messages = file.get(MESSAGES);

        if (messages[id]) {
            if (messages[id] === discriptor.message) {
                return;
            }
            throw path.buildCodeFrameError(`[L20n Error] Duplicate message id: "${id}", ` + 'but the `description` and/or `message` are different.(' + messages[id] + ' vs ' + discriptor.message + ')');
        } else if (!state.opts.duplicate) {
            if (global.messages[id] && global.messages[id] !== discriptor.message) {
                console.error(`[L20n Error] Duplicate message id: "${id}", ` + 'but the `description` and/or `message` are different.(' + global.messages[id] + ' vs ' + discriptor.message + ')');
            } else if (global.messageMap[discriptor.message] && global.messageMap[discriptor.message] !== id && !discriptor.duplicate) {
                console.warn(`[L20n Warn] Duplicate message text: "${discriptor.message}", ` + `but the "${id}" and "${global.messageMap[discriptor.message]}" are different.`);
            }
        }
        global.messageMap[discriptor.message] = id;

        if (discriptor.plural) {
            messages[id] = '{[plural(' + discriptor.plural.name + ')]}';
            for (var key in discriptor.plural.state) {
                messages[id + '[' + key + ']'] = discriptor.message + discriptor.plural.state[key];
            }
        } else {
            global.messages[id] = messages[id] = discriptor.message;
        }
    }

    function referencesImport(path, mod, importedNames) {
        if (!(path.isIdentifier() || path.isJSXIdentifier())) {
            return false;
        }
        return importedNames.some((name) => path.referencesImport(mod, name));
    }

    function tagAsExtracted(path) {
        path.node[EXTRACTED] = true;
    }

    function wasExtracted(path) {
        return !!path.node[EXTRACTED];
    }

    return {
        pre(file) {
            if (!initMap) {
                initMap = true;
                global.l20nReverse = global.l20nReverse || {};
                if (this.opts.filenames) {
                    try {
                        []
                            .concat(this.opts.filenames)
                            .forEach(function (filename) {
                                var map = JSON.parse(fs.readFileSync(fs.resolve(filename), 'utf-8'));
                                for (var key in map) {
                                    if (global.l20nReverse[map[key]]) {
                                        console.error(`[L20n] Duplicate message text: "${map[key]}", ` + `but the "${key}" and "${global.l20nReverse[map[key]]}" are different.`);
                                    } else {
                                        global.l20nReverse[map[key]] = key;
                                    }
                                }
                            });
                    } catch (e) {}
                }
            }
            if (!file.has(MESSAGES)) {
                file.set(MESSAGES, {});
            }
        },

        post(file) {
            const messages = file.get(MESSAGES);

            file.metadata['l20n'] = messages;
        },

        visitor: {

            CallExpression(path, state) {
                var moduleSourceName = getModuleSourceName(state.opts);
                var callee = path.get('callee');

                if (referencesImport(callee, moduleSourceName, FUNCTION_NAMES)) {
                    var args = path.get('arguments');
                    var obj = args[0];
                    var attribute = args[1];

                    if (obj) {
                        if (wasExtracted(obj)) {
                            return;
                        }
                        var map = {};
                        if (obj.isObjectExpression()) {
                            obj
                                .get('properties')
                                .map(prop => {
                                    prop = prop.get('value');
                                    if (prop.isObjectExpression()) {
                                        map[prop.parent.key.name] = {};

                                        prop
                                            .get('properties')
                                            .map(o => {
                                                o = o.get('value');
                                                if (o.isObjectExpression()) {
                                                    map[prop.parent.key.name][o.parent.key.name] = {};

                                                    o
                                                        .get('properties')
                                                        .map(t => {
                                                            t = t.get('value');
                                                            map[prop.parent.key.name][o.parent.key.name][t.parent.key.name] = t.parent.value.value;
                                                        })
                                                } else {
                                                    map[prop.parent.key.name][o.parent.key.name] = o.parent.value.value;
                                                }
                                            });
                                    } else {
                                        map[prop.parent.key.name] = prop.parent.value.value;
                                    }
                                });
                            storeMessage(map, path, state);
                        } else {
                            if (attribute) {
                                map.id = obj.parent.arguments[0].value;
                                attribute = attribute.parent.arguments[1].value;
                            } else {
                                map.id = obj.parent.arguments[0].value;
                            }

                            if (path.node.callee.name === 'pureMessage') {
                                map.message = attribute;
                                storeMessage(map, path, state);
                            } else {
                                // 暴力正则
                                if (path.parentPath.parent.type === 'JSXAttribute') {
                                    var str = path
                                        .hub
                                        .file
                                        .code
                                        .substr(path.parentPath.parent.start, 300);
                                    var mt = str.match(new RegExp('>([^<]*)</'));

                                    if (mt) {
                                        map.message = mt[1];
                                        storeMessage(map, path, state);
                                    }

                                    if (attribute) {
                                        map.attribute = attribute;
                                        mt = str.match(new RegExp(map.attribute + '="([^"]*)"'));
                                        if (mt) {
                                            map.message = mt[1];
                                        }
                                        storeMessage(map, path, state);
                                    }
                                }
                            }
                        }

                        // Tag the AST node so we don't try to extract it twice.
                        tagAsExtracted(obj);
                    }
                }
            }
        }
    };
}