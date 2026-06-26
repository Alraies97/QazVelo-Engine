---
name: Replit git push workaround
description: How to push to GitHub from Replit when the askpass interceptor blocks standard token-in-URL auth
---

## Rule
Use `git -c url.https://$TOKEN@host.insteadOf=https://host push` instead of `git remote set-url` with a token in the URL.

**Why:** Replit installs a `replit-git-askpass` credential helper that intercepts credential prompts. When a token is embedded in the remote URL and git tries to authenticate, askpass fires and fails with "unable to read askpass response", even though a token is present. The `url.<token-url>.insteadOf` config rewrites the URL at transport time, bypassing askpass entirely.

**How to apply:** Whenever a git push to GitHub (or any authenticated remote) is needed from the Replit shell or a bash tool call:
```bash
git -c credential.helper='' \
    -c "url.https://${GITHUB_TOKEN}@github.com.insteadOf=https://github.com" \
    push origin main
```
Store the PAT as a Replit Secret (e.g. `GITHUB_TOKEN`) — never write it to `.gitconfig` or the remote URL permanently. The remote URL stays clean (`https://github.com/...`) after the push.
