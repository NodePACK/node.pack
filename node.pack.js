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

            var result = null;

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
                return handler(packName, config).then(function (_result) {
                    if (
                        _result !== null &&
                        !limitToPack
                    ) {
                        throw new Error("Cannot call mode '" + mode + "' on pack '" + packName + "' as we are operating on multiple packs. You must specify a single pack.");
                    }
                    result = _result;
                    return null;
                });
            })).then(function () {
                return result;
            });
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
            var originalConfig = config;
            while (m = re.exec(originalConfig)) {
                config = config.replace(
                    new RegExp(m[0], "g"),
                    process.env[m[2]] || ""
                );
            }
            return LIB._.merge({
                aspect: packConfig.aspect || null
            }, JSON.parse(config));
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
                    }).then(function () {
                        return null;
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
                        return LIB.Promise.try(function () {
                            if (!syncer) return false;
                            return syncer.exists();
                        }).then(function (exists) {
                            if (!exists) {
                                LIB.log("Skip running syncer for pack '" + packName + "' as there is no remote archive!");
                                throw new Error("There is no remote archive we can download found!");
                            }
                            return syncer.download();
                        });
                    }).then(function () {
                        return packer.unpack();
                    }).then(function () {
                        return null;
                    });
                } else
                if (mode === "exists") {
                    return LIB.Promise.try(function () {
                        if (!syncer) return null;
                        return syncer.exists();
                    });
                } else
                if (mode === "canUpload") {
                    return LIB.Promise.try(function () {
                        if (!syncer) return null;
                        return syncer.canUpload();
                    });
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

    if (argv["silent"]) {
        process.env.VERBOSE = "";
        LIB.VERBOSE = false;
    } else
    if (argv["verbose"]) {
        process.env.VERBOSE = "1";
        LIB.VERBOSE = true;
    }

    // TODO: Refactor this option to work like `exists` below.
    if (argv["inline-source-stream-dirpath"]) {
        loadDescriptor(process.cwd()).then(function (descriptor) {
            process.stdout.write(LIB.path.join(process.cwd(), descriptor["node.pack"].packDirectory, [
                descriptor.name,
                "inline",
                "source.stream"
            ].join("~")));
        }).catch(error);
    } else
    if (argv["exists"]) {
        module.exports(
            process.cwd(),
            argv._[0] || "",
            "exists"
        ).then(function (exists) {
            process.stdout.write( (exists === null) ? "" : (exists ? "1": "0"));
            process.exit(0);
            return;
        }).catch(error);
    } else
    if (argv["canUpload"]) {
        module.exports(
            process.cwd(),
            argv._[0] || "",
            "canUpload"
        ).then(function (canUpload) {
            process.stdout.write( (canUpload === null) ? "" : (canUpload ? "1": "0") );
            process.exit(0);
            return;
        }).catch(error);
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

