Playwright E2E test instructions

Prerequisites
- Node.js (>=16) and npm installed
- From the `frontend` folder install dev deps for Playwright:

```bash
cd frontend
npm init -y
npm i -D @playwright/test
npx playwright install --with-deps
```

Run tests

```bash
cd frontend
npx playwright test
```

Notes
- Tests mock API endpoints under `/api/v1/*` so you don't need a running backend to execute them.
- If your frontend runs on a different origin, set `PLAYWRIGHT_BASE_URL` before running the tests, e.g.:

```bash
PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test
```

Files
- `playwright.config.ts` — test configuration
- `tests/e2e/auth-wallet.spec.ts` — single end-to-end flow (auth -> wallet -> trade -> refresh)

If you want I can add Playwright to `package.json` scripts and install it in the workspace.
