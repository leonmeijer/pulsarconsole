---
description: Release management via release-please (automated)
---

# Release Procedure

Perform a full release automatically. Do NOT prompt the user with questions — just execute all steps.

## Steps

0. **Detect the repo** — run `gh repo view --json nameWithOwner -q .nameWithOwner` to get `owner/repo`. Use `--repo owner/repo` for all subsequent `gh` commands. Extract the owner for GHCR image names.

1. **Check for a pending Release PR**:
   ```bash
   gh pr list --repo <owner/repo> --label "autorelease: pending"
   ```
   If no pending Release PR exists, inform the user and stop — there is nothing to release.

2. **Show what's in the release** — display the PR title and body.

3. **Merge the Release PR** (squash merge):
   ```bash
   gh pr merge <PR_NUMBER> --repo <owner/repo> --squash
   ```

4. **Pull the merged changes locally**:
   ```bash
   git pull
   ```

5. **Wait for the release tag to be created** — poll `gh release list --repo <owner/repo> --limit 1` every 15 seconds until the new version appears (up to 2 minutes).

6. **Wait for the Docker build to complete** — poll the latest workflow run every 15 seconds until it completes (up to 5 minutes):
   ```bash
   gh run list --repo <owner/repo> --limit 1 --json status,conclusion --jq '.[0]'
   ```

7. **Verify image tags on GHCR** — confirm the version tag exists on both images:
   ```bash
   gh api /users/<owner>/packages/container/pulsar-console-api/versions --jq '.[0].metadata.container.tags'
   gh api /users/<owner>/packages/container/pulsar-console-ui/versions --jq '.[0].metadata.container.tags'
   ```

8. **Report the result** — show:
   - Release version and GitHub release URL
   - Build status (success/failure)
   - Image tags confirmed on GHCR for both `pulsar-console-api` and `pulsar-console-ui`

## Reference

### Version Bumps
- `feat:` → minor (1.1.0 → 1.2.0)
- `fix:` → patch (1.1.0 → 1.1.1)
- `feat!:` or `BREAKING CHANGE:` → major (1.1.0 → 2.0.0)
- `chore:`, `docs:`, `ci:` → no release (bundled into next)

### Notes
- Do NOT prompt the user — this command runs fully automatically
- Do NOT modify anything in `k8s/` directory — leave versions on `latest`
