
exports.forLIB = function (LIB) {

    return function (pack) {

        function findPackages (submodules) {
            return LIB.Promise.all(pack.getPackerConfig().sourcePaths.map(function (rule) {
                var pattern = rule;
                var options = {};
                if (Array.isArray(pattern)) {
                    options = LIB._.clone(pattern[1]);
                    pattern = pattern[0];
                }
                options.nomount = true;
                options.cwd = pack.getSourceDirectory();
                options.root = options.cwd;
                return LIB.glob.globAsync(pattern, options);
            })).then(function (results) {
                var paths = [];
                results.forEach(function (results) {
                    paths = paths.concat(results);
                });
                return paths;
            });
        }

        var aspect = pack.getPackerConfig().aspect;
        var targetBasePath = pack.getFilepath(aspect, "snapshot");
        var targetArchivePath = pack.getFilepath(aspect, "tar.gz");

        return {
            exists: function () {
                return LIB.fs.existsAsync(targetArchivePath);
            },
            pack: function () {

                return LIB.fs.existsAsync(targetArchivePath).then(function (exists) {
                    if (exists) {
                        if (LIB.VERBOSE) console.log("Skip copying subset of files from '" + pack.getSourceDirectory() + "' and creating archive at '" + targetArchivePath + "' as the archive already exists. To force a new archive, bump the package version.");
                        return;
                    }
        
                    return findPackages().then(function (paths) {
        
                        if (LIB.VERBOSE) console.log("Copying subset of files from '" + pack.getSourceDirectory() + "' to '" + targetBasePath + "' and creating archive at '" + targetArchivePath + "' ...");
        
                        var commands = [];
                        // Remove existing files
                        commands.push('rm -Rf "' + targetBasePath + '" || true');
                        // Copy new files
                        paths.forEach(function (sourcePath) {
                            commands.push('mkdir -p "' + LIB.path.dirname(LIB.path.join(targetBasePath, sourcePath)) + '" || true');
                            commands.push('cp -Rf ".' + sourcePath + '" "' + LIB.path.join(targetBasePath, sourcePath) + '"');
                        });
                        // Create archive
                        commands.push('rm -Rf "' + targetArchivePath + '" || true');
                        commands.push('cd "' + targetBasePath + '"');
                        commands.push('tar czf "' + targetArchivePath + '" *');
            
                		return LIB.util.runCommands(commands, {
                		    cwd: pack.getSourceDirectory()
                		});
                    });
                });
            }
        };
    };
}
