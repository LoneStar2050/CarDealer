# Test Report

## Summary

| | |
|---|---|
| Command | `npm run test:coverage` (runs `vitest run --coverage`), from `backend/` |
| Run | 2026-10-25 18:14 IST, Node.js 26.12.1, Vitest 5.0.5, coverage provider V8 |
| Database | Real PostgreSQL test database (`car_dealer_test`), reset before each test |
| Result | **5 test files passed, 74 tests passed, 0 failed, 0 skipped** (exit code 0) |
| Duration | 24.14 s |
| Coverage thresholds | None configured, so no threshold can fail |

## Automated tests

All tests are backend integration tests that send real HTTP requests to the Express app with Supertest and run against PostgreSQL, except `tokenService.test.ts`, which is a unit test.

| Test file | Tests | What it covers |
|---|---|---|
| `tests/db/migrate.test.ts` | 8 | Schema creation, idempotent migration, unique vehicle ids, non-negative price/quantity, role check, unique email |
| `tests/auth/register.test.ts` | 12 | `POST /api/auth/register`: 201 response shape, bcrypt hashing, no password data in responses, client cannot self-assign admin; 400 for missing/invalid email and passwords under 8 characters (8 accepted); 409 for duplicate email |
| `tests/auth/login.test.ts` | 7 | `POST /api/auth/login`: 200 with a JWT whose `sub`, `role` and `exp` verify; no password data; identical 401 bodies for wrong password and unknown email; 400 for missing fields |
| `tests/auth/tokenService.test.ts` | 7 | Token lifetime: `15m`/`1h`/`2 days` produce the right expiry; lifetimes without a time unit are rejected |
| `tests/vehicles/vehicles.test.ts` | 40 | 401 without/with an invalid token; admin-only create, update, delete and restock (403 for users); listing including out-of-stock vehicles; search by make, model, category, price range and combined filters; 400 validation for bodies, ids and filters; 404 for unknown vehicles; purchase decrements and returns 409 at zero stock; three simultaneous purchases of the last unit produce exactly one success |
| **Total** | **74** | |

## Coverage

Overall, for `backend/src/**/*.ts`:

| Metric | Covered | % |
|---|---|---|
| Statements | 233 / 261 | **89.27%** |
| Branches | 131 / 156 | **83.97%** |
| Functions | 65 / 67 | **97.01%** |
| Lines | 210 / 236 | **88.98%** |

Per file (% statements / branches / functions / lines):

| File | Stmts | Branch | Funcs | Lines | Uncovered |
|---|---|---|---|---|---|
| `src/app.ts` | 100 | 100 | 100 | 100 | |
| `src/auth/authRoutes.ts` | 100 | 100 | 100 | 100 | |
| `src/auth/authService.ts` | 100 | 100 | 100 | 100 | |
| `src/auth/authValidation.ts` | 100 | 91.66 | 100 | 100 | branches at lines 18, 47 (`body ?? {}` when there is no body at all) |
| `src/auth/tokenService.ts` | 92.3 | 87.5 | 100 | 92.3 | line 71 (a correctly signed token with a malformed payload) |
| `src/auth/userRepository.ts` | 90 | 75 | 100 | 90 | line 34 (re-throwing a database error other than a duplicate email) |
| `src/db/migrate.ts` | 100 | 100 | 100 | 100 | |
| `src/db/pool.ts` | 100 | 100 | 100 | 100 | |
| `src/errors/errorHandler.ts` | 80 | 50 | 100 | 80 | line 13 (passing unexpected errors on to Express) |
| `src/errors/httpErrors.ts` | 100 | 100 | 100 | 100 | |
| `src/middleware/auth.ts` | 100 | 100 | 100 | 100 | |
| `src/vehicles/vehicleRepository.ts` | 100 | 95 | 100 | 100 | branch at line 58 (search with no filters) |
| `src/vehicles/vehicleRoutes.ts` | 100 | 100 | 100 | 100 | |
| `src/vehicles/vehicleValidation.ts` | 96.82 | 91.54 | 100 | 100 | some validation branches (lines …8, 87, 90–91, 102 as reported) |
| `src/config.ts` | 0 | 0 | 0 | 0 | not tested (startup configuration) |
| `src/server.ts` | 0 | 100 | 0 | 0 | not tested (startup entry point) |
| `src/db/seedAdmin.ts` | 0 | 0 | 100 | 0 | not tested (admin seed script) |

`src/auth/user.ts` and `src/vehicles/vehicle.ts` contain only TypeScript types (0/0 executable statements), so they have nothing to cover.

The three startup files account for most of the uncovered code (23 of the 28 uncovered statements: 5 in `config.ts`, 4 in `server.ts`, 14 in `seedAdmin.ts`). Excluding them, the lowest statement coverage is `errorHandler.ts` at 80%; every other file is at 90% or above.

## Manual verification (not automated)

These checks were run by hand or by script against the running application. They are not part of the test suite above.

- **API walkthrough (curl, live server):** register and login; 401 without a token; 403 for a regular user creating, restocking or deleting; admin create, update and restock; search; purchase down to zero, then 409.
- **Browser walkthrough (headless Chrome via Playwright, driving the real frontend and backend):**
  - *Admin:* login, inventory list, Edit/Restock/Delete/Add controls visible, a zero-stock vehicle's Purchase button disabled, search by make, restock, delete, logout. All passed.
  - *Regular user:* login, inventory list, no admin controls, search by category, two purchases taking stock from 2 to 0, Purchase disabled at zero. All passed.
  - Screenshots are in [`docs/screenshots/`](docs/screenshots/) and shown in the README.
- **Startup:** `npm run seed:admin` created the admin account and `npm start` served the API (this is how `config.ts`, `server.ts` and `seedAdmin.ts` were exercised).

## Known limitations

- **No frontend automated tests.** The frontend was checked with `npm run build` (TypeScript plus a production build, which passed when run during development, separately from this report's run) and the browser walkthrough above.
- **Startup files are not covered** by automated tests (`config.ts`, `server.ts`, `seedAdmin.ts`), only by the manual startup check.
- **Unexpected server errors** (for example, a lost database connection) are passed to Express's default handler (`errorHandler.ts` line 13, uncovered). That handler responds with HTML, not the API's JSON error format.
- **Coverage is reported but not enforced:** `vitest.config.ts` sets no thresholds.

## Reproducing

```bash
createdb car_dealer_test          # once
cd backend
cp .env.test.example .env.test    # once
npm install
npm run test:coverage             # text summary in the terminal, HTML report in backend/coverage/
```
