---
name: Port 5000 webview rule for Replit Next.js
description: When a workflow is "webview" type, Replit releases port 5000 for the app. "Console" type keeps port 5000 held by Replit proxy, causing 502 externally.
---

## Rule
Next.js in this monorepo MUST bind to port 5000 in `artifacts/faslbook-v2/package.json` dev/start scripts.
The workflow MUST be `outputType = "webview"` with `waitForPort = 5000`.

**Why:** Replit's external proxy maps `localPort=5000 → externalPort=80`. The proxy only releases port 5000 to user processes when the workflow is webview type. Console workflows keep 5000 held, causing 502 for all external visitors. The `PORT=5000 pnpm run dev` prefix does NOT reliably pass through to shell expansion in pnpm scripts.

**How to apply:** Always hardcode `-p 5000` in the `next dev` and `next start` scripts. Never use `${PORT:-3000}` fallback. Never change the workflow to "console" type.
