#!/usr/bin/env node


var LIB = {
    VERBOSE: false,
    assert: require("assert"),
    path: require("path"),
    fs: require("fs-extra"),
    _: require("lodash"),
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


function log () {
    if (!LIB.VERBOSE) return;
    var args = Array.prototype.slice.call(arguments);
    args.unshift("[node.pack]");
    console.log.apply(console, args);
}


function loadDescriptor (packageDirectory) {
    var path = LIB.path.join(packageDirectory, "package.json");
    log("Load descriptor from '" + path + "'");
    return LIB.fs.readJsonAsync(path).then(function (descriptor) {
        descriptor._path = path;

        LIB.assert.notEqual(typeof descriptor["name"], "undefined", "'name' property must be set in '" + descriptor._path + "'");
        LIB.assert.notEqual(typeof descriptor["version"], "undefined", "'version' property must be set in '" + descriptor._path + "'");
        LIB.assert.equal(typeof descriptor["node.pack"], "object", "'node.pack' property must be set in '" + descriptor._path + "'");
        LIB.assert.equal(typeof descriptor["node.pack"].packs, "object", "'[\"node.pack\"].packs' property must be set in '" + descriptor._path + "'");

        descriptor["node.pack"].packDirectory = descriptor["node.pack"].packDirectory || ".packs";

        return descriptor;
    });
}


module.exports = function (packageDirectory) {

    function forEachConfiguredPack (handler) {
        return loadDescriptor(packageDirectory).then(function (descriptor) {

            // TODO: Take depends order into account.
            return LIB.Promise.all(Object.keys(descriptor["node.pack"].packs).map(function (packName) {
                var config = LIB._.clone(descriptor["node.pack"].packs[packName]);
                LIB._.assign(config, {
                    packDirectory: LIB.path.join(packageDirectory, config.packDirectory || descriptor["node.pack"].packDirectory),
                    package: {
                        name: descriptor["name"],
                        version: descriptor["version"]
                    }
                });
                return handler(packName, config);
            }));
        });    
    }

    function loadPacker (pointer) {
        var relpath = pointer + "/packer.js";
        if (/^node\.pack\//.test(relpath)) {
            relpath = LIB.path.join(__dirname, "..", relpath);
        }
        log("Load packer for pointer '" + pointer + "' from path '" + require.resolve(relpath) + "'");
        if (!loadPacker._instances) {
            loadPacker._instances = {};
        }
        if (!loadPacker._instances[relpath]) {
            loadPacker._instances[relpath] = LIB.Promise.resolve(
                require(relpath).forLIB(LIB)
            );
        }
        return loadPacker._instances[relpath];
    }


    var Pack = function (packName, packConfig) {
        var self = this;

        self.getName = function () {
            return packName;
        }

        self.getSourceStreamDirpath = function () {
            return LIB.path.join(packConfig.packDirectory, [
                packConfig.package.name,
                packName,
                "source.stream"
            ].join("~"));
        }

        self.getFilepath = function (aspect, extension) {
            return LIB.path.join(packConfig.packDirectory, [
                packConfig.package.name,
                packConfig.package.version,
                packName,
                process.platform,
                process.arch,
                packConfig.environment || "NodeJS-" + process.version.split(".").shift(),
                aspect + "." + extension
            ].join("~"));
        }

        self.getSourceDirectory = function () {
            return packageDirectory;
        }

        self.getPackerConfig = function () {
            return packConfig.packer.config || {};
        }

        self.getSyncerConfig = function () {
            return (packConfig.syncer && packConfig.syncer.config) || {};
        }
    }

    return forEachConfiguredPack(function (packName, packConfig) {

        LIB.assert.equal(typeof packConfig.packer, "object", "'packer' property must be set in config for pack '" + packName + "'");
        LIB.assert.equal(typeof packConfig.packer.module, "string", "'packer.module' property must be set in config for pack '" + packName + "'");

        return loadPacker(packConfig.packer.module).then(function (packer) {

            var pack = new Pack(packName, packConfig);

            log("Run packer '" + packConfig.packer.module + "' for pack '" + packName + "' and config:", packConfig);

            return packer(pack);
        });
    });
}



if (require.main === module) {

    function error (err) {
        log("ERROR");
        console.error(err.stack);
        process.exit(1);
        return;
    }

    if (process.argv.indexOf("--inline-source-stream-dirpath") !== -1) {
        loadDescriptor(process.cwd()).then(function (descriptor) {
            process.stdout.write(LIB.path.join(process.cwd(), descriptor["node.pack"].packDirectory, [
                descriptor.name,
                "inline",
                "source.stream"
            ].join("~")));
        }).catch(error)
    } else {
        module.exports(
            process.cwd()
        ).then(function () {
            log("Success");
            process.exit(0);
            return;
        }).catch(error);
    }
}

