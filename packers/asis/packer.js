
exports.forLIB = function (LIB) {

    return function (pack) {

        var config = pack.getSyncerConfig();		



console.log("tar.gz pack", pack.getFilepath("build", "tar.gz"));


        // TODO: Setup 



        return LIB.Promise.resolve();        
    };
}
