# Test Plan — Auth form state isolation (PR #7)

## Context
PR #7 splits `AuthScreen` into `LoginForm` (`loginUsername`/`loginPassword`) and `RegisterForm`
(`registerUsername`/`registerEmail`/`registerPassword`/`registerConfirmPassword`), rendered via
`{isLogin ? <LoginForm/> : <RegisterForm/>}` (AuthScreen.tsx:54) so the inactive form fully unmounts.
Unique ids: `login-username`/`login-password` vs `register-username`/`register-email`/`register-password`/`register-confirm-password`.
Confirm-password match check: RegisterForm.tsx:24-27. UI path: localhost:3000 logged-out → AuthScreen.

## Tests (single recording)

### Test 1 — State isolation across forms (the core fix)
- On **Sign In**, type username `loginonly` and password `loginpass1`.
- Verify DOM: inputs have `id="login-username"` / `id="login-password"`.
- Click **Register**.
- **PASS:** Register's Username and Password fields are **EMPTY** (and Email empty). DOM shows `id="register-username"` etc.
- **FAIL (old shared-state behavior):** Register Username pre-filled with `loginonly` / password carried over.
- Click **Sign In** again → fields show `loginonly` / `loginpass1` again is NOT required (fresh remount resets state); the key assertion is **no bleed into Register**. Note actual observed behavior.

### Test 2 — Confirm-password mismatch blocks submit
- On **Register**: Username `splituser<rand>`, Email `<same>@example.com`, Password `password123`, Confirm Password `different999`.
- Click **Create Account**.
- **PASS:** inline red error `Passwords do not match`; stays on Register; backend shows **NO** `POST /auth/register`.
- **FAIL:** account created / navigates to dashboard / different or no error.

### Test 3 — Matching confirm registers end-to-end
- Fix Confirm Password to `password123` (matches). Click **Create Account**.
- **PASS:** dashboard loads; navbar shows the username; backend logs `POST /auth/register 201` then `POST /auth/login 200`.
- **FAIL:** stays on Register / error.
