---
description: Release management via release-please (automated)
---

# Release Procedure

Releases are **fully automated** via [release-please](https://github.com/googleapis/release-please).

## How It Works

1. Push commits to `main` using **conventional commits** (`feat:`, `fix:`, `chore:`, etc.)
2. release-please automatically creates/updates a **Release PR** with:
   - Computed next version (based on commit types)
   - Updated `CHANGELOG.md`
   - Updated `.release-please-manifest.json`
3. **Merge the Release PR** → release-please creates a GitHub Release + tag
4. The tag automatically triggers Docker image builds via `build-and-publish.yml`

## Version Bumps

- `feat:` commits → bump **minor** (e.g., 1.1.0 → 1.2.0)
- `fix:` commits → bump **patch** (e.g., 1.1.0 → 1.1.1)
- `feat!:` or `BREAKING CHANGE:` → bump **major** (e.g., 1.1.0 → 2.0.0)
- `chore:`, `docs:`, `ci:` → no release (bundled into the next one)

## Check Status

```bash
# Check for open Release PR
gh pr list --repo pezzking/pulsarconsole --label "autorelease: pending"

# Check recent releases
gh release list --repo pezzking/pulsarconsole --limit 5

# Check build status
gh run list --repo pezzking/pulsarconsole --limit 3
```

## Manual Release (fallback)

If you need to create a release manually (e.g., hotfix):

```bash
gh workflow run release.yml --repo pezzking/pulsarconsole -f version=X.Y.Z
```

## Image Names

Docker images are pushed to GHCR on each release:
- `ghcr.io/pezzking/pulsar-console-api`
- `ghcr.io/pezzking/pulsar-console-ui`

Each release produces tags: `latest`, `vX.Y.Z`, `vX.Y`, and the git short SHA.

## Notes

- Do NOT modify anything in `k8s/` directory - leave versions on `latest`
- Use conventional commit messages so release-please can compute versions correctly
