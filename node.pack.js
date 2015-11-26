#!/usr/bin/env node

const LIB = require("./lib");


function loadDescriptor (packageDirectory) {
    var path = LIB.path.join(packageDirectory, "package.json");
    LIB.log("Load descriptor from '" + path + "'");
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


module.exports = function (packageDirectory, limitToPack, mode) {

    function forEachConfiguredPack (handler) {
        return loadDescriptor(packageDirectory).then(function (descriptor) {

            // TODO: Take depends order into account.
            return LIB.Promise.all(Object.keys(descriptor["node.pack"].packs).map(function (packName) {
                if (
                    limitToPack &&
                    packName !== limitToPack
                ) return;

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

    function loadAdapterModule (pointer, type) {
        var relpath = pointer + "/" + type + ".js";
        if (/^node\.pack\//.test(relpath)) {
            relpath = LIB.path.join(__dirname, "..", relpath);
        }
        LIB.log("Load " + type + " for pointer '" + pointer + "' from path '" + require.resolve(relpath) + "'");
        if (!loadAdapterModule._instances) {
            loadAdapterModule._instances = {};
        }
        if (!loadAdapterModule._instances[relpath]) {
            loadAdapterModule._instances[relpath] = LIB.Promise.resolve(
                require(relpath).forLIB(LIB)
            );
        }
        return loadAdapterModule._instances[relpath];
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

        function resolveConfig (config) {
            config = JSON.stringify(config, null, 4);
            var re = /\{\{(!)?(?:env|ENV)\.([^\}]+)\}\}/g;
            var m;
            while (m = re.exec(config)) {
                config = config.replace(
                    new RegExp(m[0], "g"),
                    process.env[m[2]] || ""
                );
            }
            return JSON.parse(config);
        }

        self.getPackerConfig = function () {
            return resolveConfig((packConfig.packer && packConfig.packer.config) || {});
        }

        self.getSyncerConfig = function () {
            return resolveConfig((packConfig.syncer && packConfig.syncer.config) || {});
        }
    }

    return forEachConfiguredPack(function (packName, packConfig) {

        function initSyncer () {
            if (!packConfig.syncer) {
                return LIB.Promise.resolve(null);
            }
            LIB.assert.equal(typeof packConfig.syncer.module, "string", "'syncer.module' property must be set in config for pack '" + packName + "'");
            return loadAdapterModule(packConfig.syncer.module, "syncer").then(function (syncer) {
                var pack = new Pack(packName, packConfig);
                LIB.log("Init syncer '" + packConfig.syncer.module + "' for pack '" + packName + "'");
                return syncer(pack);
            });
        }

        function initPacker () {
            if (!packConfig.packer) {
                return LIB.Promise.resolve(null);
            }
            LIB.assert.equal(typeof packConfig.packer.module, "string", "'packer.module' property must be set in config for pack '" + packName + "'");
            return loadAdapterModule(packConfig.packer.module, "packer").then(function (packer) {
                var pack = new Pack(packName, packConfig);
                LIB.log("Init packer '" + packConfig.packer.module + "' for pack '" + packName + "'");
                return packer(pack);
            });
        }

        return initPacker().then(function (packer) {

            return initSyncer().then(function (syncer) {

                if (mode === "pack") {
                    // If the pack exists remotely we do not pack it again locally.
                    // TODO: Add option to pack it anyway.
                    return LIB.Promise.try(function () {
                        if (!syncer) return false;
                        return syncer.exists();
                    }).then(function (exists) {
                        if (exists) {
                            LIB.log("Skip running packer '" + packConfig.packer.module + "' and syncer for pack '" + packName + "' as remote packs already exist.");
                            return;
                        }
                        return packer.pack().then(function () {
                            if (!syncer) return;
                            return syncer.upload();
                        });
                    });
                } else
                if (mode === "unpack") {
                    return LIB.Promise.try(function () {
                        if (!packer) throw new Error("'packer' must be delcared for pack '" + packName + "'");
                        return packer.exists();
                    }).then(function (exists) {
                        if (exists) {
                            LIB.log("Skip running syncer for pack '" + packName + "' as local packs already exist.");
                            return;
                        }
                        return syncer.download();
                    }).then(function () {

console.log("TODO: extract!");


                    });
/*
                    return existsRemote().then(function (exists) {
                        if (!exists) {
                            LIB.log("Skip running syncer and unpack '" + packConfig.packer.module + "' for pack '" + packName + "' as remote pack does not exist.");
                            return;
                        }
                        return ensureLocal().then(function (exists) {
*/                        
                        
    
                    
    console.log("UNPACK!");
    
    
//                    });
    
                } else {
                    throw new Error("Mode '" + mode + "' not supported!");
                }
            });
        });
    });
}


if (require.main === module) {

    function error (err) {
        LIB.log("ERROR");
        console.error(err.stack);
        process.exit(1);
        return;
    }

    var argv = LIB.minimist(process.argv.slice(2));

    if (argv["verbose"]) {
        process.env.VERBOSE = "1";
        LIB.VERBOSE = true;
    }

    if (argv["inline-source-stream-dirpath"]) {
        loadDescriptor(process.cwd()).then(function (descriptor) {
            process.stdout.write(LIB.path.join(process.cwd(), descriptor["node.pack"].packDirectory, [
                descriptor.name,
                "inline",
                "source.stream"
            ].join("~")));
        }).catch(error)
    } else {
        module.exports(
            process.cwd(),
            argv._[0] || "",
            argv["unpack"] ? "unpack" : "pack"
        ).then(function () {
            LIB.log("Success");
            process.exit(0);
            return;
        }).catch(error);
    }
}

