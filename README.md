node.pack
=========

Pack a bunch of **installed** [NodeJS](http://nodejs.org) (and other self-contained) code packages into an archive for optimized batch provisioning in identical environments.

This means you take [npm](http://npmjs.org) and other package registries out of the picture when deploying your code for the second time in an identical environment. It makes deployment **much more resilient to failure** and **guarantees you are running IDENTICAL code every time**.

`node.pack` empowers you to create multiple *packs* from the same installation so you can put infrequently changing third party packages into one *pack* and your own code into another *pack*.

**Origin:** This project stems from work I have been doing for [sm.genesis](https://github.com/sourcemint/sm.genesis) and serves to validate the *filename format* and *built package bundles* for reliable runtime code distribution.


Filenames
---------

Format: `<PackageName>~<PackageVersion>~<PackName>~<Platform>~<Architecture>~<Environment>~<PackAspect>.<FormatExtension>`

Where:

  * `Environment` - Defaults to `NodeJS-4` and can be set to describe a more specific compile environment


License
=======

MIT
