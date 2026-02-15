# Changelog

## [1.3.0](https://github.com/pezzking/pulsarconsole/compare/v1.2.1...v1.3.0) (2026-02-15)


### Features

* interactive JSON tree viewer, release automation, and CI improvements ([d56400d](https://github.com/pezzking/pulsarconsole/commit/d56400d94ae7849782d62ab1ddd346ca71e72ec2))


### Bug Fixes

* enable release-please on all repos ([9e3fa0b](https://github.com/pezzking/pulsarconsole/commit/9e3fa0bdf14cdd204367e9a6d2f96761947e3eb8))
* enable release-please on upstream repo ([#13](https://github.com/pezzking/pulsarconsole/issues/13)) ([89404c5](https://github.com/pezzking/pulsarconsole/commit/89404c58791e71245021e16a181a1c3cecfee627))
* remove release-please skip condition for upstream ([6a3ff27](https://github.com/pezzking/pulsarconsole/commit/6a3ff27bd35b9553a272f91c0dc9c265eb9be023))
* skip release-please on upstream repo ([c94e636](https://github.com/pezzking/pulsarconsole/commit/c94e636411b4e0e045790fb3593f47bdbb1e3527))
* skip release-please on upstream repo ([#12](https://github.com/pezzking/pulsarconsole/issues/12)) ([36d46b4](https://github.com/pezzking/pulsarconsole/commit/36d46b4970026de00acb3d6bcb741d073a230abe))
* update aggregation model to use environment_id and fix auto-refresh stability ([7a4b4cc](https://github.com/pezzking/pulsarconsole/commit/7a4b4cc340cca67e28954327639ec5e9cd46ee94))

## [1.2.1](https://github.com/pezzking/pulsarconsole/compare/v1.2.0...v1.2.1) (2026-02-14)


### Bug Fixes

* tag Docker images with version from release-please ([837197a](https://github.com/pezzking/pulsarconsole/commit/837197a465fc78065f1dc0a5224ccfa6d54fb7e5))

## [1.2.0](https://github.com/pezzking/pulsarconsole/compare/v1.1.2...v1.2.0) (2026-02-14)


### Features

* add interactive JSON tree viewer for topic messages ([6472bf1](https://github.com/pezzking/pulsarconsole/commit/6472bf1fa00783af0c439ac200327b00c150bef1))
* add release-please for automated releases ([b691774](https://github.com/pezzking/pulsarconsole/commit/b691774cbc95b2bbc826015d7ca006fa86b01749))


### Bug Fixes

* build Docker images for linux/amd64 only ([f22cafc](https://github.com/pezzking/pulsarconsole/commit/f22cafcaa0d9c6c21596e53f3dba78eceeb2e975))

## [1.1.2](https://github.com/pezzking/pulsarconsole/compare/v1.1.1...v1.1.2) (2025-02-14)

### Bug Fixes

* trigger Docker build automatically after release creation ([ebe1426](https://github.com/pezzking/pulsarconsole/commit/ebe1426))

## [1.1.1](https://github.com/pezzking/pulsarconsole/compare/v1.1.0...v1.1.1) (2025-02-14)

### Bug Fixes

* request OIDC groups scope for group-based role mapping ([c63b795](https://github.com/pezzking/pulsarconsole/commit/c63b795))

## [1.1.0](https://github.com/pezzking/pulsarconsole/compare/v1.0.5...v1.1.0) (2025-02-13)

### Features

* OIDC group-to-role mappings with global env var support
* add local development build instructions with Docker
