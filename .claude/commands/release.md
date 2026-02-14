---
description: Release a new version with Docker image builds
---

# Release Procedure

## Steps

1. **Check latest release version**
   ```bash
   gh release list --repo pezzking/pulsarconsole --limit 5
   ```

2. **Determine next version** (semver)
   - `feat:` commits → bump minor (e.g., 1.1.0 → 1.2.0)
   - `fix:` commits only → bump patch (e.g., 1.1.0 → 1.1.1)
   - Breaking changes → bump major

3. **Commit and push changes**
   ```bash
   git push origin main
   ```

4. **Create GitHub release** (this creates the tag, which triggers the Docker build)
   ```bash
   gh api repos/pezzking/pulsarconsole/releases -f tag_name=vX.Y.Z -f name="vX.Y.Z" -F generate_release_notes=true
   ```

5. **Verify build completion**
   ```bash
   gh run list --repo pezzking/pulsarconsole --limit 3
   ```

## Image Names

Docker images are built and pushed to GHCR **only on tag pushes** (not on every push to main):
- `ghcr.io/pezzking/pulsar-console-api`
- `ghcr.io/pezzking/pulsar-console-ui`

Each release produces tags: `latest`, `vX.Y.Z`, `vX.Y`, and the git short SHA.

## Notes

- Do NOT modify anything in `k8s/` directory - leave versions on `latest`
