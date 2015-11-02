
exports.forLIB = function (LIB) {

    const AWS_SDK = require("aws-sdk");

    return function (pack) {

        var config = pack.getSyncerConfig();		

		// @see http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html

	    LIB.assert.equal(typeof config.iamUserName, "string");
	    LIB.assert.equal(typeof config.accessKeyId, "string");
	    LIB.assert.equal(typeof config.secretAccessKey, "string");
	    LIB.assert.equal(typeof config.s3, "object");
	    LIB.assert.equal(typeof config.s3.bucket, "string");
	    LIB.assert.equal(typeof config.s3.publicHost, "string");
	    LIB.assert.equal(typeof config.s3.path, "string");
	    LIB.assert.equal(typeof config.s3.region, "string");

	    LIB.assert.ok(/\.amazonaws\.com$/.test(config.s3.publicHost), "'publicHost' must end with '.amazonaws.com'");

	    // TODO: Delegate request signing to 'space.pinf.genesis/access/0' so we don't
	    //       need credentials here and potentially leak them.
	    var awsConfig = new AWS_SDK.Config({
	        accessKeyId: config.accessKeyId,
	        secretAccessKey: config.secretAccessKey,
	        region: config.s3.region
	    });

		var s3 = new AWS_SDK.S3(awsConfig);


console.log("s3", s3);


        return LIB.Promise.resolve();        
    };
}
