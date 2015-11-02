
exports.forLIB = function (LIB) {

    return function (pack) {

        var config = pack.getSyncerConfig();		


        return LIB.Promise.resolve();        
    };
}
