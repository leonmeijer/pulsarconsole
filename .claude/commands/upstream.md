---
description: Sync with upstream and create PRs to upstream repository
---

# Upstream Management

Upstream repository: `leonmeijer/pulsarconsole`

## Sync from Upstream

Pull latest changes from upstream into our fork:

```bash
git fetch upstream
git merge upstream/main
git push origin main
```

## Create PR to Upstream

1. **Create a feature branch**
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Make changes and commit**
   ```bash
   git add .
   git commit -m "feat: description of changes"
   ```

3. **Push to our fork**
   ```bash
   git push origin feature/my-feature
   ```

4. **Create PR to upstream**
   ```bash
   gh pr create --repo leonmeijer/pulsarconsole --title "feat: description" --body "Description of changes"
   ```

## Check Upstream Status

```bash
git fetch upstream
git log main..upstream/main --oneline    # Commits we're missing
git log upstream/main..main --oneline    # Our commits not in upstream
```

## Notes

- Always sync from upstream before creating PRs to avoid conflicts
- Do NOT add Co-Authored-By lines to commits
