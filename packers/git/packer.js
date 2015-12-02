
/*
The `git` packer uses git branches to maintain a stream of code suitable for download into a runtime container using tools such as:
  * https://github.com/eladb/node-girror

The branches used are:

  * `<branch>` - The branch containing the source (and associated installation) to pack which is typically 'master'.
  * `<branch>.nodepack` - The **NodePACK source stream** for `<branch>` with all to be packed paths and submodules removed and nodepack descriptor written.
  * `<branch>.nodepack.<pack>` - The **NodePACK build stream** for `<branch>` with all submodules inlined and pointers to download/upload build files for packed paths for the various runtime contexts.
*/

exports.forLIB = function (LIB) {


    function packCommon (pack) {
        if (!packCommon._instance) {
            
            // NOTE: The `pack` data we access is IDENTICAL for all pack instances!

            var rootPath = pack.getSourceDirectory();
            var sourceStreamDirpath = pack.getSourceStreamDirpath();

            function scanSourceSubmodules () {
    
                function findSubmodules () {

                    var submodules = {};

        		    return LIB.fs.existsAsync(
        		        LIB.path.join(rootPath, ".gitmodules")
        		    ).then(function (exists) {
        		        if (!exists) {
        		            return submodules;
        		        }
            		    return LIB.fs.readFileAsync(
            		        LIB.path.join(rootPath, ".gitmodules"),
            		        "utf8"
            		    ).then(function (data) {
    
                            function memoizeSubmodule () {
                                if (!currentSubmodule) return;
            					submodules["/" + currentSubmodule.path] = {
            						url: currentSubmodule.url
            					};
                            }
                            
            				var lines = data.split("\n");
            				var currentSubmodule = null;
            				for (var i=0, l=lines.length ; i<l ; i++) {
            					var m = lines[i].match(/^\[submodule "([^"]+)"\]$/);
            					if (m) {
            					    memoizeSubmodule();
            						currentSubmodule = {};
            					} else {
            						m = lines[i].match(/^\s*([\S]+)\s*=\s*([\S]+)\s*$/);
            						if (m) {
            							currentSubmodule[m[1]] = m[2];
            						}
            					}
            				}
        				    memoizeSubmodule();
                            return submodules;
            		    });
        		    });
        		}
        		
        		function getSubmoduleStatus (submodules) {
        
                    // NOTE: git version 2.x is required to resolve submodules properly.
        
            		var commands = Object.keys(submodules).map(function (path) {
            			return [
            				'echo "[repository]"',
            				'echo "' + path.replace(/^\//, "") + '"',
            				'pushd "' + path.replace(/^\//, "") + '"',
            				'echo "[repository.branch]"',
            				'git branch',
            				'echo "[repository.log]"',
            				'git log -n 1',
            				'popd'
            			].join(";");
            		});
        
        		    // TODO: Use pure nodejs solution for this.
            		return LIB.util.runCommands(commands, {
            		    cwd: rootPath
            		}).then(function (stdout) {
            			var current = {
            				path: null,
            				section: null
            			};
            			var lines = stdout.split("\n");
            			var m = null;
            			for (var i=0,l=lines.length ; i<l ; i++) {
            				// section boundaries
            				m = lines[i].match(/^\[repository(\.([^\]]+))?\]$/);
            				if (m) {
            					current.section = m[2] || "";
            					continue;
            				}
            				// section content
            				if (current.section === "") {
            					current.path = "/" + lines[i];
            					i += 1;
            					submodules[current.path].branch = null;
            				} else
            				if (current.section === "branch") {
            					m = lines[i].match(/^\* ((\(detached from )?([^\)]+)(\))?)/);
            					if (m) {
            						if (m[1] === m[3]) {
            							submodules[current.path].branch = m[1];
            						} else {
            							submodules[current.path].branch = false;
            						}
            					}
            				} else
            				if (current.section === "log") {
            					m = lines[i].match(/^commit (.+)$/);
            					if (m) {
            						submodules[current.path].ref = m[1];
            					}
            					m = lines[i].match(/^Date:\s*(.+)$/);
            					if (m) {
            						submodules[current.path].date = new Date(m[1]).getTime();
            					}
            				}
            			}
            			return submodules;
            		});
        		}
    
                return findSubmodules().then(function (submodules) {
                    return getSubmoduleStatus(submodules);
                });
            }
    
            function deriveNodePackSourceStream (submodules) {
    
                function mergeChanges () {
                    var commands = [
        			    'VERBOSE="1"',
        				'. ' + LIB.path.join(__dirname, "packer.proto.sh"),
        				'git_exitOnDirtyWorking',
        				'git_getBranch "BRANCH"',
        				'git_getTag "TAG"',
        				'git_getRemoteUrl "ORIGIN_URL" "origin"',
        				'SOURCE_STREAM="$BRANCH.nodepack"',
        				'echo "TAG: $TAG"',
        				'echo "BRANCH: $BRANCH"',
        				'echo "SOURCE_STREAM: $SOURCE_STREAM"',
        				'echo "Packing branch \'$BRANCH\' at tag \'$TAG\' from origin \'$ORIGIN_URL\'"',
        				'git_ensureCleanClone "$ORIGIN_URL" "' + sourceStreamDirpath + '"',
        				'pushd "' + sourceStreamDirpath + '" > /dev/null',
                			'git_ensureSyncedBranch "$SOURCE_STREAM"',
                			'git_mergeFromSource "' + rootPath + '" "$BRANCH" "$TAG" "$SOURCE_STREAM"',
                    ];
                    Object.keys(submodules).forEach(function (path) {
            			commands = commands.concat([
            			    'git_removeSubmodule "' + path.replace(/^\//, "") + '"'
            			]);
            		});
        			commands = commands.concat([
                		'popd > /dev/null'
                	]);
        
        		    // TODO: Use pure nodejs solution for this.
            		return LIB.util.runCommands(commands, {
            		    cwd: rootPath,
            		    verbose: true
            		}).then(function (stdout) { 
            		    
            		    var info = {};
            		    stdout.split("\n").forEach(function (line) {
            		        var m = line.match(/^BRANCH: (\S+)$/);
            		        if (m) {
            		            info.branch = m[1];
            		        }
            		        m = line.match(/^TAG: (\S+)$/);
            		        if (m) {
            		            info.tag = m[1];
            		        }
            		        m = line.match(/^SOURCE_STREAM: (\S+)$/);
            		        if (m) {
            		            info.sourceStream = m[1];
            		        }
            		    });
    
                        return info;
            		});
                }

                function writeDescriptor (tag) {
                    return LIB.fs.readJsonAsync(LIB.path.join(sourceStreamDirpath, "package.json")).then(function (descriptor) {
                        descriptor.version = tag.replace(/^v/, "");
                        // TODO: Instead of over-writing version in descriptor add support for an overlay file for package.json.    
                        return LIB.fs.outputFileAsync(
                            LIB.path.join(sourceStreamDirpath, "package.json"),
                            JSON.stringify(descriptor, null, 4)
                        );
                    }).then(function () {
                        return LIB.fs.outputFileAsync(
                            LIB.path.join(sourceStreamDirpath, "node.pack.json"),
                            LIB.CJSON({
                                "submodules": submodules
                            }, null, 4)
                        );
                    }).then(function () {
                        return LIB.util.runCommands([
                            'VERBOSE="1"',
            				'. ' + LIB.path.join(__dirname, "packer.proto.sh"),
            				'git_commitChanges "NodePACK source stream descriptor"'
                        ], {
                		    cwd: sourceStreamDirpath,
                		    verbose: true
                		});
                		// TODO: If commit fails with conflict, fix conflict automatically and run again.
                    });
                }

                function publishStream (branch) {
                    return LIB.util.runCommands([
                        'VERBOSE="1"',
        				'. ' + LIB.path.join(__dirname, "packer.proto.sh"),
        				'git push origin ' + branch
                    ], {
            		    cwd: sourceStreamDirpath,
            		    verbose: true
            		});
                }
    
                return mergeChanges().then(function (info) {
    
                    return writeDescriptor(info.tag).then(function () {
    
                        return publishStream(info.sourceStream).then(function () {

                            return info;
                        });
                    });
                });
            }

            packCommon._instance = scanSourceSubmodules().then(function (submodules) {
                return deriveNodePackSourceStream(submodules).then(function (info) {
                    info.submodules = submodules;
                    return info;
                });
            });
        }
        return packCommon._instance;
    }


    return function (pack) {
        
        return {
            pack: function () {

                return packCommon(pack).then(function (info) {

                    var config = pack.getPackerConfig();
                    var sourceStreamDirpath = pack.getSourceStreamDirpath();
                    var packName = pack.getName();
                    var buildStream = info.sourceStream + "." + packName;
        
                    // TODO: Deal with `config.ignoreSubmodules`
        
                    function deriveNodePackBuildStream () {
                        
                        function mergeChanges () {
                            var commands = [
                                'VERBOSE="1"',
                				'. ' + LIB.path.join(__dirname, "packer.proto.sh"),
                    			'git_ensureSyncedBranch "' + buildStream + '"',
                    			'git_mergeFromBranch "' + info.sourceStream + '"',
                				'git push origin ' + buildStream,
                    			// Remove git ignore file
                    			'rm .gitignore > /dev/null || true',
                    			'git rm .gitignore > /dev/null || true'
                            ];
                            Object.keys(info.submodules).forEach(function (path) {
                                var targetPath = LIB.path.join(sourceStreamDirpath, path, "..");
                                if (!LIB.fs.existsSync(targetPath)) {
                                    LIB.fs.mkdirsSync(targetPath);
                                }
                    			commands = commands.concat([
                    			    'rm -Rf "' + path.replace(/^\//, "") + '" || true',
                    			    'echo "Clone ' + info.submodules[path].url + ' to ' + path.replace(/^\//, "") + '"',
                    			    'git clone "' + info.submodules[path].url + '" "' + path.replace(/^\//, "") + '"',
                    			    'pushd "' + path.replace(/^\//, "") + '" > /dev/null',
                    			        'git checkout ' + info.submodules[path].ref,
                    			        'git submodule update --init --recursive --rebase || true',
                    			        'rm -Rf .git',
                    			        'find . -name .git -prune | while read d; do',
                                        '  rm -Rf "$d"',
                                        'done',
                    			    'popd > /dev/null'
                    			]);
                            });

                            commands.push('git_commitChanges "Inlined submodule updates"');

                		    // TODO: Use pure nodejs solution for this.
                    		return LIB.util.runCommands(commands, {
                    		    cwd: sourceStreamDirpath,
                    		    verbose: true
                    		});
                        }
        
                        function publishStream (branch) {
                            return LIB.util.runCommands([
                                'VERBOSE="1"',
                				'. ' + LIB.path.join(__dirname, "packer.proto.sh"),
                				'git push origin ' + branch
                            ], {
                    		    cwd: sourceStreamDirpath,
                    		    verbose: true
                    		});
                        }
        
                        return mergeChanges().then(function () {
        
                            return publishStream(buildStream);
                        });
                    }
            
        
                    return deriveNodePackBuildStream();
                });                
            }
        };
    };
}
