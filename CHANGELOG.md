# Changelog

## [1.3.0](https://github.com/leonmeijer/pulsarconsole/compare/v1.2.1...v1.3.0) (2026-02-15)


### Features

* add email, slack, and webhook notification channels ([bda86e6](https://github.com/leonmeijer/pulsarconsole/commit/bda86e61a8e5be92324a09f04a0fe1f355b617d6))
* add email, slack, and webhook notification channels ([9da861f](https://github.com/leonmeijer/pulsarconsole/commit/9da861f16ce33eacd01fd3a30b38f8c330440470))
* add endpoint to revoke all other sessions for the current user ([c24821e](https://github.com/leonmeijer/pulsarconsole/commit/c24821e163739daeac7569257b10c4b4c4f723ed))
* add environment data to Dashboard component ([b802b48](https://github.com/leonmeijer/pulsarconsole/commit/b802b488b10c434acda1164164551786d4945a24))
* add interactive JSON tree viewer for topic messages ([6472bf1](https://github.com/leonmeijer/pulsarconsole/commit/6472bf1fa00783af0c439ac200327b00c150bef1))
* add local development build instructions with Docker ([420f625](https://github.com/leonmeijer/pulsarconsole/commit/420f62515989414984309accfea4faa957650c35))
* add notification channels (email, slack, webhook) ([189c417](https://github.com/leonmeijer/pulsarconsole/commit/189c417f29946c6df5f72ff9ac4959be9fef1be2))
* add notification channels management and tests ([5c93ec3](https://github.com/leonmeijer/pulsarconsole/commit/5c93ec3d668f00be41ece3e8543d2dbbbd4c6795))
* add notification channels management and tests ([f789c7c](https://github.com/leonmeijer/pulsarconsole/commit/f789c7c4d528633ebaaad69d536f107c2e79e644))
* add notification channels settings UI ([36ef0d4](https://github.com/leonmeijer/pulsarconsole/commit/36ef0d43bf36b4470c24af62f83bba960679df30))
* add notification channels settings UI ([f08992b](https://github.com/leonmeijer/pulsarconsole/commit/f08992b6cee94c0d1a6ff5f6ebe15c72ec34e59e))
* add release-please for automated releases ([b691774](https://github.com/leonmeijer/pulsarconsole/commit/b691774cbc95b2bbc826015d7ca006fa86b01749))
* add release-please for automated releases ([e40484f](https://github.com/leonmeijer/pulsarconsole/commit/e40484fea1d75a7e6563c6fc9cff082efbee2fea))
* add release-please for automated releases ([1510e7a](https://github.com/leonmeijer/pulsarconsole/commit/1510e7adf3d55a89619e014980b7f6e3355eb47e))
* add topic and subscription metrics to UI ([4bddab0](https://github.com/leonmeijer/pulsarconsole/commit/4bddab039ac6b45d9022454026b2e93c440c0afe))
* enhance theme preference management and UI updates ([9e51f59](https://github.com/leonmeijer/pulsarconsole/commit/9e51f59ad67019a14ca2b9790eaf9c1cd0255160))
* enhance theme preference management and UI updates ([2880c24](https://github.com/leonmeijer/pulsarconsole/commit/2880c24f9a9a7df8ae442633b67eb4af5c4960ef))
* implement OIDC support and enhance user management ([cbe42a9](https://github.com/leonmeijer/pulsarconsole/commit/cbe42a940315de947ca558ca9ca214f6c056abc8))
* interactive JSON tree viewer, release automation, and CI improvements ([d56400d](https://github.com/leonmeijer/pulsarconsole/commit/d56400d94ae7849782d62ab1ddd346ca71e72ec2))
* make pulsar cluster name configurable via PULSAR_CLUSTER env var ([e92edea](https://github.com/leonmeijer/pulsarconsole/commit/e92edea167ea5fb32fb8d6b8e7d4e030825d443b))
* make pulsar cluster name configurable via PULSAR_CLUSTER env var ([e75f2a2](https://github.com/leonmeijer/pulsarconsole/commit/e75f2a2c2deda49d51a3675ee71239d8ffe97faf))
* OIDC group-to-role mapping and various improvements ([6b380fd](https://github.com/leonmeijer/pulsarconsole/commit/6b380fdeb886a744de6b5571ec7016e390c4e745))
* OIDC group-to-role mapping and various improvements ([f67c096](https://github.com/leonmeijer/pulsarconsole/commit/f67c0961d68cca3928c067b91b45016b9150ca42))
* topic metrics, OIDC group mappings, CI improvements ([73cde57](https://github.com/leonmeijer/pulsarconsole/commit/73cde57bc61c942cf056dd473e058e04efb09fae))


### Bug Fixes

* add debug output and fix Dockerfile casing ([e296518](https://github.com/leonmeijer/pulsarconsole/commit/e2965187f4fc26664dc453f1c0e6b916da60029d))
* add Docker Hub login to avoid rate limits ([0ff7d26](https://github.com/leonmeijer/pulsarconsole/commit/0ff7d26221630618ad1fb7bad03443ba26afb29d))
* build Docker images for linux/amd64 only ([f22cafc](https://github.com/leonmeijer/pulsarconsole/commit/f22cafcaa0d9c6c21596e53f3dba78eceeb2e975))
* improve PR with security, bug fixes, and performance ([f3cf89a](https://github.com/leonmeijer/pulsarconsole/commit/f3cf89a251ee25ba54a115361baddd4df6719d6e))
* improve PR with security, bug fixes, and performance ([26fbbcb](https://github.com/leonmeijer/pulsarconsole/commit/26fbbcb9ab2cf31cb612b8f77219c7f1341828f6))
* make database migrations idempotent for enum types ([088fb53](https://github.com/leonmeijer/pulsarconsole/commit/088fb53b105148cce0f9edaec73b714461cb924a))
* request OIDC groups scope for group-based role mapping ([c63b795](https://github.com/leonmeijer/pulsarconsole/commit/c63b795ee215ce8e038d9d60537886eb341facd4))
* set is_global_admin=True for dev user when OIDC disabled ([88b20cf](https://github.com/leonmeijer/pulsarconsole/commit/88b20cf18fd990b844df70206bd0e2d53fa0a55e))
* support OIDC group-to-role mappings via global env vars ([a79b308](https://github.com/leonmeijer/pulsarconsole/commit/a79b30856293d8f368043713843ea6cccd54df54))
* tag Docker images with version from release-please ([837197a](https://github.com/leonmeijer/pulsarconsole/commit/837197a465fc78065f1dc0a5224ccfa6d54fb7e5))
* use solid background for modal dialogs ([b6fc687](https://github.com/leonmeijer/pulsarconsole/commit/b6fc687801e6533edd1b0e5fb45d48fd0da22d5b))
* use solid background for modal dialogs ([5255a99](https://github.com/leonmeijer/pulsarconsole/commit/5255a99567f2251541200dfa54d36d06d58779fd))

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
