#!/usr/bin/env node

var LIB = {
    VERBOSE: (!!process.env.VERBOSE) || false,
    assert: require("assert"),
    path: require("path"),
    fs: require("fs-extra"),
    minimist: require("minimist"),
    _: require("lodash"),
    glob: require("glob"),
    request: require("request"),
    CJSON: require("canonical-json"),
    Promise: require("bluebird"),
    child_process: require("child_process")
};
LIB.util = require("./util").forLib(LIB);
LIB.Promise.promisifyAll(LIB.fs);
LIB.fs.existsAsync = function (path) {
    return new LIB.Promise(function (resolve, reject) {
        return LIB.fs.exists(path, resolve);
    });
}
LIB.Promise.promisifyAll(LIB.glob);
LIB.Promise.promisifyAll(LIB.request);


LIB.log = function () {
    if (!LIB.VERBOSE) return;
    var args = Array.prototype.slice.call(arguments);
    args.unshift("[node.pack]");
    console.log.apply(console, args);
}

module.exports = LIB;
