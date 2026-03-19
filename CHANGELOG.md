# [1.0.0](https://github.com/edobry/keyfabe/compare/v0.9.0...v1.0.0) (2026-03-19)


* feat!: 1.0 release polish — add missing test coverage and fix docs ([24fd9d6](https://github.com/edobry/keyfabe/commit/24fd9d6a998b9b324eb88302fd8505b1291790d1))


### BREAKING CHANGES

* First stable release — public API is now committed.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>

# [0.9.0](https://github.com/edobry/keyfabe/compare/v0.8.0...v0.9.0) (2026-02-17)


### Features

* add diagnostic card detection with actionable error messages ([70277af](https://github.com/edobry/keyfabe/commit/70277af05b60b5bfd429ac5d94a12de5a55d74e5))
* add non-interactive mode for scripting and piped usage ([304b316](https://github.com/edobry/keyfabe/commit/304b316fece4d59d4e83fa9075504fd6f9b01ecc))

# [0.8.0](https://github.com/edobry/keyfabe/compare/v0.7.1...v0.8.0) (2026-02-15)


### Features

* add full-card MIFARE Classic cloning with automatic key cracking ([136edc8](https://github.com/edobry/keyfabe/commit/136edc833c57a0daa2d3ec469951cfc67b21c86f))

## [0.7.1](https://github.com/edobry/keyfabe/compare/v0.7.0...v0.7.1) (2026-02-14)


### Bug Fixes

* detect bricked cards during write and suggest repair command ([1db7455](https://github.com/edobry/keyfabe/commit/1db7455a1e6bb5d1201f30431e436bae4ce46bc3))

# [0.7.0](https://github.com/edobry/keyfabe/compare/v0.6.0...v0.7.0) (2026-02-14)


### Features

* add verify command to compare tag on reader against saved identity ([4b55ab8](https://github.com/edobry/keyfabe/commit/4b55ab8107b7f7ff18259a812b9895484f5e8709))

# [0.6.0](https://github.com/edobry/keyfabe/compare/v0.5.3...v0.6.0) (2026-02-14)


### Features

* add Gen2/CUID magic card support and repair command ([4039a8a](https://github.com/edobry/keyfabe/commit/4039a8a6116b0209d8f0eba0e27387cbaed90af6))

## [0.5.3](https://github.com/edobry/keyfabe/compare/v0.5.2...v0.5.3) (2026-02-14)


### Bug Fixes

* use correct hf mf csetuid syntax with -u flag ([7032c0b](https://github.com/edobry/keyfabe/commit/7032c0b9857a6b16da17e51936353b39bb99ee35))

## [0.5.2](https://github.com/edobry/keyfabe/compare/v0.5.1...v0.5.2) (2026-02-14)


### Bug Fixes

* recognize hf mf csetuid success output and guide users on magic cards ([beb041a](https://github.com/edobry/keyfabe/commit/beb041a5af0e8ea88ebeebd6e5d5feae060f14df))

## [0.5.1](https://github.com/edobry/keyfabe/compare/v0.5.0...v0.5.1) (2026-02-14)


### Bug Fixes

* read version from package.json instead of hardcoding ([5bf0a92](https://github.com/edobry/keyfabe/commit/5bf0a92305714ce22587986777e90179d831f27f))

# [0.5.0](https://github.com/edobry/keyfabe/compare/v0.4.0...v0.5.0) (2026-02-14)


### Features

* add HF write support, dedup strings, normalize terminology to "tag" ([23f6d6d](https://github.com/edobry/keyfabe/commit/23f6d6d1b5e80a7daadff7e68e20dbc08b4c67d6))

# [0.4.0](https://github.com/edobry/keyfabe/compare/v0.3.0...v0.4.0) (2026-02-14)


### Features

* add HF (13.56 MHz) card detection for MIFARE and ISO 14443-A ([34fe026](https://github.com/edobry/keyfabe/commit/34fe026db8443dea3d86b13055620c836b40bbc9))

# [0.3.0](https://github.com/edobry/keyfabe/compare/v0.2.0...v0.3.0) (2026-02-10)


### Features

* add default interactive wizard menu ([c3118d0](https://github.com/edobry/keyfabe/commit/c3118d01c94e751cc55efc4263d01e5d3ca2d53e))
* add interactive fob selection for write/show/delete/rename ([8ed9eac](https://github.com/edobry/keyfabe/commit/8ed9eac5651142ebc81be992c1820caacf6559cd))

# [0.2.0](https://github.com/edobry/keyfabe/compare/v0.1.2...v0.2.0) (2026-02-10)


### Features

* add doctor diagnostics, first-run hints, and list improvements ([e1e7353](https://github.com/edobry/keyfabe/commit/e1e7353ed65d4e4aabfb98ca5fd8f24838cc5b9c))

## [0.1.2](https://github.com/edobry/keyfabe/compare/v0.1.1...v0.1.2) (2026-02-10)


### Bug Fixes

* check for device before running pm3 commands ([f968594](https://github.com/edobry/keyfabe/commit/f96859452862e8f4d314853eb3dfebd668878bd8))

## [0.1.1](https://github.com/edobry/keyfabe/compare/v0.1.0...v0.1.1) (2026-02-10)


### Bug Fixes

* re-trigger release with corrected trusted publisher config ([a079115](https://github.com/edobry/keyfabe/commit/a079115491ca3e4dd18c542eb71fe54b9c43cb7d))
* remove registry-url from setup-node to allow OIDC auth ([59f5510](https://github.com/edobry/keyfabe/commit/59f5510583aeab5c4fd20db29a22e0827464037b))
* restore registry-url with empty token for OIDC fallthrough ([55ecbde](https://github.com/edobry/keyfabe/commit/55ecbde660c9eb32adddeea78040c4af38ab7e9c))
* upgrade semantic-release to v25 for native OIDC trusted publishing ([ee9f0a3](https://github.com/edobry/keyfabe/commit/ee9f0a332ab602d8e5cd5dc15a8ab61ea31f2a21))
* use @semantic-release/npm v13 for native OIDC trusted publishing ([4295ca3](https://github.com/edobry/keyfabe/commit/4295ca3b2d6a9b995923132194a84e6a225f1c60))
* use exec plugin for npm publish with trusted publishing ([04d1ff6](https://github.com/edobry/keyfabe/commit/04d1ff66a5ec5496af5d35295ed01f134bbdbecf))

## [0.1.1](https://github.com/edobry/keyfabe/compare/v0.1.0...v0.1.1) (2026-02-09)


### Bug Fixes

* re-trigger release with corrected trusted publisher config ([a079115](https://github.com/edobry/keyfabe/commit/a079115491ca3e4dd18c542eb71fe54b9c43cb7d))
* remove registry-url from setup-node to allow OIDC auth ([59f5510](https://github.com/edobry/keyfabe/commit/59f5510583aeab5c4fd20db29a22e0827464037b))
* restore registry-url with empty token for OIDC fallthrough ([55ecbde](https://github.com/edobry/keyfabe/commit/55ecbde660c9eb32adddeea78040c4af38ab7e9c))
* use exec plugin for npm publish with trusted publishing ([04d1ff6](https://github.com/edobry/keyfabe/commit/04d1ff66a5ec5496af5d35295ed01f134bbdbecf))

## [0.1.1](https://github.com/edobry/keyfabe/compare/v0.1.0...v0.1.1) (2026-02-09)


### Bug Fixes

* re-trigger release with corrected trusted publisher config ([a079115](https://github.com/edobry/keyfabe/commit/a079115491ca3e4dd18c542eb71fe54b9c43cb7d))
* remove registry-url from setup-node to allow OIDC auth ([59f5510](https://github.com/edobry/keyfabe/commit/59f5510583aeab5c4fd20db29a22e0827464037b))
* use exec plugin for npm publish with trusted publishing ([04d1ff6](https://github.com/edobry/keyfabe/commit/04d1ff66a5ec5496af5d35295ed01f134bbdbecf))

## [0.1.1](https://github.com/edobry/keyfabe/compare/v0.1.0...v0.1.1) (2026-02-09)


### Bug Fixes

* re-trigger release with corrected trusted publisher config ([a079115](https://github.com/edobry/keyfabe/commit/a079115491ca3e4dd18c542eb71fe54b9c43cb7d))
* use exec plugin for npm publish with trusted publishing ([04d1ff6](https://github.com/edobry/keyfabe/commit/04d1ff66a5ec5496af5d35295ed01f134bbdbecf))

## [0.1.1](https://github.com/edobry/keyfabe/compare/v0.1.0...v0.1.1) (2026-02-09)


### Bug Fixes

* use exec plugin for npm publish with trusted publishing ([04d1ff6](https://github.com/edobry/keyfabe/commit/04d1ff66a5ec5496af5d35295ed01f134bbdbecf))
