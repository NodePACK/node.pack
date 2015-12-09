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


	function tar_extractToIgnoreExisting {
		BO_log "$VERBOSE" "Extracting '$1' to '$2' while ignoring existing files ..."

        local TAR_CMD="" 

	    # TODO: Ensure GNU tar is provisioned using a `bash.origin` plugin.
	    if which gtar; then
	        # Specifically use GNU tar if available (OSX)
	        TAR_CMD="gtar"
	    elif [[ $(tar --version) =~ "GNU" ]]; then
	        # The `tar` command that is installed is GNU tar.
	        TAR_CMD="tar"
		else
		   echo "Error: GNU \'tar\' (or \'gtar\') not found! If you are on OSX you can install it with \'brew install gnu-tar\'"
		   exit 1
	    fi

        # If the former fails we assume we are using an older verion and the latter should succeed.
        # TODO: Check actual version and use only supported arguments.
        "$TAR_CMD" --skip-old-files -xf "$1" -C "$2" || "$TAR_CMD" --keep-old-files -xf "$1" -C "$2"
	}
}
init $@