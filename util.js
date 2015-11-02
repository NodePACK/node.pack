
exports.forLib = function (LIB) {

    const VERBOSE = false;

    var exports = {};

    exports.runCommands = function (commands, options) {
		return LIB.Promise.promisify(function (callback) {
		    options = options || {}
		    options.verbose = options.verbose || VERBOSE;
			if (options.verbose) {
				console.log("Running commands:", commands);
			}
		    var proc = LIB.child_process.spawn("bash", [
		        "-s"
		    ], options);
		    proc.on("error", function(err) {
		    	return callback(err);
		    });
		    var stdout = [];
		    var stderr = [];
		    proc.stdout.on('data', function (data) {
		    	stdout.push(data.toString());
				if (options.verbose || options.progress) process.stdout.write(data);
		    });
		    proc.stderr.on('data', function (data) {
		    	stderr.push(data.toString());
				if (options.verbose || options.progress) process.stderr.write(data);
		    });
		    proc.stdin.write(commands.join("\n"));
		    proc.stdin.end();
		    proc.on('close', function (code) {
		    	if (code) {
		    		var err = new Error("Commands exited with code: " + code);
		    		err.code = code;
		    		err.stdout = stdout;
		    		err.stderr = stderr;
		    		console.error("err", err);
		    		return callback(err);
		    	}
		        return callback(null, stdout.join(""));
		    });
		})();
	}

	return exports;
}
