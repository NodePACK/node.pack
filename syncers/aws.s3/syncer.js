
exports.forLIB = function (LIB) {

    const AWS_SDK = require("aws-sdk");

    return function (pack) {

        var config = pack.getSyncerConfig();

		// @see http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html

	    LIB.assert.equal(typeof config.aws.iamUserName, "string");
	    LIB.assert.equal(typeof config.aws.accessKeyId, "string");
	    LIB.assert.equal(typeof config.aws.secretAccessKey, "string");
	    LIB.assert.equal(typeof config.aws.s3, "object");
	    LIB.assert.equal(typeof config.aws.s3.bucket, "string");
	    LIB.assert.equal(typeof config.aws.s3.publicHost, "string");
	    LIB.assert.equal(typeof config.aws.s3.path, "string");
	    LIB.assert.equal(typeof config.aws.s3.region, "string");

	    LIB.assert.ok(/\.amazonaws\.com$/.test(config.aws.s3.publicHost), "'publicHost' must end with '.amazonaws.com'");

	    // TODO: Delegate request signing to 'space.pinf.genesis/access/0' so we don't
	    //       need credentials here and potentially leak them.
	    var opts = {
	        accessKeyId: config.aws.accessKeyId,
	        secretAccessKey: config.aws.secretAccessKey,
	        region: config.aws.s3.region
	    };
	    if (LIB.VERBOSE) {
	    	opts.logger = console;
	    }
	    var awsConfig = new AWS_SDK.Config(opts);

		var s3 = new AWS_SDK.S3(awsConfig);
		LIB.Promise.promisifyAll(s3);


        var aspect = pack.getPackerConfig().aspect;
        var targetArchivePath = pack.getFilepath(aspect, "tar.gz");
		var assetKey = config.aws.s3.path + "/" + LIB.path.basename(targetArchivePath);
		var publicUrl = "http://" + pack.getSyncerConfig().aws.s3.publicHost + "/" + config.aws.s3.bucket + "/" + assetKey;


		function checkExisting () {
			// This doe not require AWS credentials.
			return LIB.request.headAsync(publicUrl).then(function (response) {
				if (response.statusCode === 200) return true;
				return false;
			});
			/*
			// This requires AWS credentials.
			return s3.headObjectAsync({
				Bucket: config.aws.s3.bucket,
				Key: assetKey
			}).then(function (data) {
				// TODO: Verify etag etc...
				return true;
			}).catch(function (err) {
				if (
					err.statusCode === 404 ||
					err.statusCode === 403
				) {
					return false;
				}
				throw err;
			});
			*/
		}

		function uploadNew () {
			if (LIB.VERBOSE) console.log("Uploading archive '" + targetArchivePath + "' to '" + config.aws.s3.bucket + "/" + assetKey + "' ...");
			return s3.putObjectAsync({
				Bucket: config.aws.s3.bucket,
				Key: assetKey,
				ACL: "public-read",
				Body: LIB.fs.createReadStream(targetArchivePath)
			}).then(function (data) {
				if (LIB.VERBOSE) console.log("Uploaded archive '" + targetArchivePath + "' to '" + config.aws.s3.bucket + "/" + assetKey + "'!");
				return null;
			});
		}

    	return {
    		exists: function () {
    			return checkExisting();
    		},
    		upload: function () {
				return checkExisting().then(function (existing) {
					if (existing) {
						if (LIB.VERBOSE) console.log("Archive already uploaded to '" + config.aws.s3.bucket + "/" + assetKey + "'");
						return null;
					}
					return uploadNew();
				});    	
    		},
    		download: function () {
    			return new LIB.Promise(function (resolve, reject) {
    				var tmpPath = targetArchivePath + "~" + Date.now();
					if (LIB.VERBOSE) console.log("Downloading archive from '" + publicUrl + "' to '" + tmpPath + "' ...");
					var writer = LIB.fs.createWriteStream(tmpPath);
					writer.once("finish", function () {
						if (LIB.VERBOSE) console.log("Downloaded archive from '" + publicUrl + "' to '" + targetArchivePath + "'!");
						return LIB.fs.renameAsync(tmpPath, targetArchivePath).then(resolve, reject);
					});
					return LIB.request
						.get(publicUrl)
						.on('error', reject)
						.pipe(writer);
    			});
    		}
    	};
    };
}
