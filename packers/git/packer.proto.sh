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


	function git_exitOnDirtyWorking {
	    if git_isWorkingDirty ; then
	        echo "ERROR: Aborting. Working directory '$(pwd)' contains uncommitted changes!"
	        echo "Action: Commit changes"
	        exit 1;
        fi
	}
	function git_isWorkingDirty {
		BO_log "$VERBOSE" "Check if working directory '$(pwd)' is dirty ..."
	    if [[ $(git diff --shortstat 2> /dev/null | tail -n1) != "" ]] || [[ $(git status -s 2> /dev/null | tail -n1) != "" ]]; then
	        return 0;
        fi
        return 1;
	}

	function git_assertRemote {
		BO_log "$VERBOSE" "Ensuring remote '$1' exists for git working directory '$(pwd)' ..."
	    if [[ $(git remote show "$1" 2>&1 | grep fatal) != "" ]]; then
	        echo "ERROR: Aborting. '$1' git remote not configured for working directory '$(pwd)'!"
	        echo "Action: Run 'git remote add $1 <GitURL>"
	        exit 1;
        fi
    }

    function git_getBranch {
		BO_setResult "$1" "$(git symbolic-ref --short HEAD)"
    }

    function git_getTag {
		# Get tag to publish
		if [[ $(git describe --tags 2>&1 | grep fatal | tail -n1) != "" ]]; then
	        echo "ERROR: Aborting. Your repository must have at least one tag!"
	        echo "Action: Tag your repository. You can use 'git tag v0.0.0' if you don'e have releases yet."
	        exit 1;
		fi
		BO_setResult "$1" "$(git describe --tags)"
	}
	
	function getRemoteUrl {
	    BO_setResult "$1" `git config --get remote.$2.url`
	}


	function git_ensureCleanClone {
		BO_log "$VERBOSE" "Ensure we have a clean clone of '$1' at '$2' ..."
	    if [ ! -e "$2" ]; then
		    if [ ! -e "$(dirname $2)" ]; then
		        mkdir -p "$(dirname $2)"
	        fi
	        git clone $1 $2
	    fi
	    git reset --hard
	    git clean -df
	}

	function git_ensureRemote {
		BO_log "$VERBOSE" "Ensure remote '$1' pointing to '$2' ..."
		git remote rm "$1"
		git remote add "$1" "$2"
	}

	function git_ensureSyncedBranch {
	    # Ensure deploy repo/branch is clean and up to date
		BO_log "$VERBOSE" "Reset and update '$(pwd)' repo to branch '$1' ..."
	    git reset --hard
	    git checkout -b "$1" 2> /dev/null || git checkout "$1"
	    git clean -df
	    git fetch origin "$1" || true
		git merge -X theirs "origin/$1" -m "Merge upstream changes" || true
	    git clean -df
	}

	function git_ensureSyncedRemoteBranch {
	    # Ensure current branch is synced to given remote branch
	    git_getBranch "BRANCH"
		BO_log "$VERBOSE" "Sync local branch '$BRANCH' to remote '$1' branch '$2' ..."
	    git reset --hard
	    git clean -df
	    git fetch "$1" "$2" || true
		git merge -X ours "$1/$2" -m "Merge upstream changes" || true
	    git clean -df
	    git push -f "$1" "$2"
	}

	function git_mergeFromSource {
	    # $1: "$SOURCE_REPOSITORY_PATH"
	    # $2: "$BRANCH"
	    # $3: "$DEPLOY_TAG"
	    # $4: "$DEPLOY_BRANCH"
		BO_log "$VERBOSE" "Merge changes for branch '$2' resulting in commit '$3' on stream '$4' from '$1' to '$(pwd)'"
		git remote add source "$1/.git" 2> /dev/null || true
		git fetch source
		git merge -X theirs "source/$2" -m "changes for branch '$2' resulting in commit '$3' on stream '$4'"

        function disabled {
			# @source http://stackoverflow.com/a/27338013/330439
			git checkout -b "source-$BRANCH" "source/$BRANCH" || git checkout "source-$BRANCH"
			git pull source "$BRANCH"
			git checkout "$DEPLOY_BRANCH"
			git merge -s ours "source-$BRANCH" -m "Changes for branch '$BRANCH' resulting in commit '$DEPLOY_TAG' on stream '$DEPLOY_BRANCH'"
			git checkout --detach "source-$BRANCH"
			git reset --soft "$DEPLOY_BRANCH"
			git checkout "$DEPLOY_BRANCH"
			git commit --allow-empty --amend -C HEAD
		    git clean -df
        }
	}

	function git_mergeFromBranch {
		BO_log "$VERBOSE" "Merge changes from branch '$1'"
		git merge "$1" -m "merge changes from branch '$1'"
	}

	function git_removeSubmodule {
		BO_log "$VERBOSE" "Removing submodule '$1' from working tree '$(pwd)' ..."
		# @source http://stackoverflow.com/a/16162000/330439
		rm -Rf "$1" || true
		git submodule deinit "$1"    || true 
		git rm "$1" || true
		git rm --cached "$1" || true
        git add -A || true
        git commit -m "Removed submodule '$1'" || true
	}

	function git_commitChanges {
		BO_log "$VERBOSE" "Commiting changes '$1' for working tree '$(pwd)' ..."
        git add -A || true
        git commit -m "$1" || true
	}

}
init $@