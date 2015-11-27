#!/bin/bash -e
if [ -z "$HOME" ]; then
	echo "ERROR: 'HOME' environment variable is not set!"
	exit 1
fi
# Source https://github.com/bash-origin/bash.origin
. "$HOME/.bash.origin"
function init {
	eval BO_SELF_BASH_SOURCE="$BO_READ_SELF_BASH_SOURCE"
	BO_deriveSelfDir ___TMP___ "$BO_SELF_BASH_SOURCE"
	local __BO_DIR__="$___TMP___"

    NODE_PACK_SCRIPT_PATH="$__BO_DIR__/node.pack.js"


    function node.pack {
        BO_format "$VERBOSE" "HEADER" "NodePACK workspace directory '$(pwd)'"

        "$NODE_PACK_SCRIPT_PATH" $@

        BO_format "$VERBOSE" "FOOTER"
    }
    
    function node.pack.inline.source.stream.dirpath {
        BO_setResult "$1" "$($NODE_PACK_SCRIPT_PATH --inline-source-stream-dirpath)"
    }

    function node.pack.dependencies.canUpload {
        BO_setResult "$1" "$($NODE_PACK_SCRIPT_PATH dependencies --canUpload --silent)"
    }

}
init $@