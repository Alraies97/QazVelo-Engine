# Test Plan — Auth form isolation (PR #6)

## Context
Reported bug (NOT reproducible on main): typing on Register toggles to Login; register/login can't complete locally.
PR #6 hardens: `AuthScreen.tsx` fields now have stable `key` + unique `id`/`name` (`auth-username`/`auth-email`/`auth-password`); `api.ts` skips refresh-retry for `/auth/*` (api.ts:68).
UI path: localhost:3000 logged-out → AuthScreen (page.tsx:22). Toggle buttons AuthScreen.tsx:63-92 (`type="button"`). Submit handler:32-47 (`e.preventDefault()`).

## Tests (single recording)

### Test 1: It should NOT auto-toggle and should isolate fields between modes
- Click **Register**. Type username `isotest`, email `iso@example.com`, password `secret12345`.
- Assert (DOM): inputs expose `id="auth-username"`, `id="auth-email"`, `id="auth-password"` with matching `name`s. (If broken/old: no id/name.)
- Assert (behavior): after typing, the active mode stays **Register** (Create Account button visible) — it does NOT flip to Sign In.
- Click **Sign In**: email field disappears; username still `isotest`, password still present. Click **Register** again: email still shows `iso@example.com`.
- Pass: no auto-toggle; all values retained across toggles; ids present.

### Test 2: It should register a brand-new user end-to-end
- In Register, use a unique username `isodemo<rand>`, email, password `password123` → **Create Account**.
- Pass: auth screen replaced by dashboard; navbar shows the username. Fail: stays on auth screen / error.

### Test 3: It should show an inline error on wrong-password login (no state churn)
- Log out → Sign In. Username = the just-registered user, password = `wrongpass99` → **Sign In**.
- Pass: inline red error `Incorrect username or password`; stays on the Sign In screen; no redirect/blank. Backend shows a single `POST /auth/login 401` and NO `POST /auth/refresh` afterward (verifies the api.ts auth-endpoint guard).
- Fail: blank screen, redirect, or a `/auth/refresh` call fired after the failed login.
