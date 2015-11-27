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


    function node.unpack {
        BO_format "$VERBOSE" "HEADER" "NodeUnPACK workspace directory '$(pwd)'"

        "$NODE_PACK_SCRIPT_PATH" --unpack $@

        BO_format "$VERBOSE" "FOOTER"
    }

    function node.unpack.dependencies.exists {
        BO_setResult "$1" "$($NODE_PACK_SCRIPT_PATH dependencies --exists --silent)"
    }

}
init $@