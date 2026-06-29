# Test Report — Auth form state isolation (PR #7)

**How tested:** Ran the full local stack (FastAPI :8000 + Next.js :3000) on the fix branch and exercised the auth flow through the UI while watching backend logs.

## Results
- ✅ **State isolation (core fix):** typed `loginonly` + password in Sign-In → switched to Register → all Register fields (Username/Email/Password/Confirm) were **EMPTY**; inputs have unique ids (`login-username`/`login-password` vs `register-*`). Old shared-state code would have carried the value into Register.
- ✅ **Confirm-password mismatch:** Register with Password `password123` / Confirm `different999` → inline `Passwords do not match`, stayed on Register, and **no** `POST /auth/register` hit the backend.
- ✅ **Matching confirm registers e2e:** fixed Confirm to `password123` → `POST /auth/register 201` + `POST /auth/login 200` → dashboard shows `splituser88`.

## Evidence

### Test 1 — State isolation across forms
| 🔴 Sign-In filled (loginonly / pass) | 🟢 Switch to Register → all fields EMPTY |
|---|---|
| ![Sign-In filled](https://app.devin.ai/attachments/e4942128-7a26-418c-9bec-c3a8d3554ad7/ss_6eea8ef3.png) | ![Register empty](https://app.devin.ai/attachments/beafa244-10be-4dac-90e7-02255102064c/ss_c6fdac54.png) |

### Test 2 & 3 — Confirm password
| 🔴 Mismatch blocked | 🟢 Matching → dashboard |
|---|---|
| ![Passwords do not match](https://app.devin.ai/attachments/170d88a1-1148-44fd-a07b-e1ce9a62de4e/ss_7a376569.png) | ![Dashboard splituser88](https://app.devin.ai/attachments/6827dd3d-d6bf-495e-92a4-12678d7f7c4f/ss_f757e7b6.png) |

Backend log (matching-confirm flow):
```
POST /api/v1/auth/register 201 Created
POST /api/v1/auth/login    200 OK
✅ Created new mock wallet for user 7 with balance $10000.0
```
(No `/auth/register` was logged during the mismatch attempt.)
