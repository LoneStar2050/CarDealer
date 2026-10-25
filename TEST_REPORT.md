# Test Report

## Summary

All results below are from a single verification run on 2026-10-25 at 19:25 IST (Node.js 26.12.1), after the frontend redesign.

| Check | Command (directory) | Result |
|---|---|---|
| Frontend tests | `npm test` (`frontend/`) | **2 files, 29 tests passed, 0 failed, 0 skipped** (exit 0, 2.51 s) |
| Frontend build | `npm run build` (`frontend/`) | **Passed** (exit 0): `tsc --noEmit` with no errors, then `vite build` |
| Backend tests | `npm test` (`backend/`) | **5 files, 74 tests passed, 0 failed, 0 skipped** (exit 0, 22.55 s) |
| Backend type-check | `npm run typecheck` (`backend/`) | **Passed** (exit 0, no errors) |
| Backend coverage | `npm run test:coverage` (`backend/`) | 74 passed; statements 89.27%, branches 83.97%, functions 97.01%, lines 88.98% (exit 0) |
| Browser verification | headless Chrome against the running app | **All 32 checks passed** (see below) |

**Total automated tests: 103 (29 frontend + 74 backend), all passing.**

No coverage thresholds are configured, so no threshold can fail. Frontend coverage was **not measured**: no coverage provider is installed in `frontend/`.

**Backend unchanged by the redesign:** `git diff HEAD -- backend` is empty and there are no untracked files under `backend/`. The last commit that touched `backend/` is `ccad9ec` (server entry point, config and seed script), which is before the redesign.

## Frontend automated tests

Vitest 5.0.5 with React Testing Library on jsdom. The UI tests render the whole app and drive it as a user would. Network calls go to an in-test fake of the API (`src/test/fakeApi.ts`) that copies the real routes, status codes and `{ error }` bodies; the live app always uses the real backend.

| Test file › group | Tests | What it covers |
|---|---|---|
| `format.test.ts` › formatRupees | 4 | Indian rupee formatting: ₹15,00,000, ₹8,00,000, ₹999, ₹0 |
| `App.test.tsx` › authentication | 6 | Sign-in through the form; API error for wrong credentials; inline password-length validation on registration (no request sent); inline errors clear when the field is edited; show/hide password; expired session (401) returns to sign-in with a message |
| `App.test.tsx` › inventory | 4 | Hero with an "Explore Inventory" link; cards with category, rupee price, stock and image; error message when the inventory fails to load; empty state with a count of 0 |
| `App.test.tsx` › search and filters | 4 | Make, model, category and price filters sent as search query parameters; category options taken from the data; Clear filters; sorting by price (both ways) and by name |
| `App.test.tsx` › purchasing | 3 | Purchase enabled when in stock, disabled with "Out of stock" at zero; pending state that blocks a second click (only one request sent) and updates the stock with a success message; API error shown when a purchase fails |
| `App.test.tsx` › admin controls | 8 | Hidden from regular users; shown to admins, including the stock table; add vehicle with validation first; field errors clear once corrected; edit; restock with a quantity input; delete only after confirmation; server error shown when the backend refuses an admin action (403) |
| **Total** | **29** | |

Build output: 31 modules transformed; `dist/index.html` 0.43 kB, CSS 27.09 kB (5.84 kB gzip), JS 254.49 kB (77.02 kB gzip).

## Backend automated tests

Integration tests that send real HTTP requests to the Express app with Supertest and run against a real PostgreSQL test database (`car_dealer_test`), reset before each test. `tokenService.test.ts` is a unit test.

| Test file | Tests | What it covers |
|---|---|---|
| `tests/db/migrate.test.ts` | 8 | Schema creation, idempotent migration, unique vehicle ids, non-negative price/quantity, role check, unique email |
| `tests/auth/register.test.ts` | 12 | `POST /api/auth/register`: 201 shape, bcrypt hashing, no password data, no self-assigned admin; 400 for missing/invalid email and passwords under 8 characters (8 accepted); 409 for a duplicate email |
| `tests/auth/login.test.ts` | 7 | `POST /api/auth/login`: 200 with a JWT whose `sub`, `role` and `exp` verify; no password data; identical 401 bodies for wrong password and unknown email; 400 for missing fields |
| `tests/auth/tokenService.test.ts` | 7 | Token lifetime: `15m`/`1h`/`2 days` give the right expiry; lifetimes without a unit are rejected |
| `tests/vehicles/vehicles.test.ts` | 40 | 401 without/with an invalid token; admin-only create, update, delete, restock (403 for users); listing including out-of-stock vehicles; search by make, model, category, price range and combined filters; 400 validation; 404 for unknown vehicles; purchase decrements and returns 409 at zero; three simultaneous purchases of the last unit give exactly one success |
| **Total** | **74** | |

## Backend coverage

From `npm run test:coverage` (V8 provider, `backend/src/**/*.ts`). Identical to the previous report, as expected with no backend changes.

| Metric | Covered | % |
|---|---|---|
| Statements | 233 / 261 | **89.27%** |
| Branches | 131 / 156 | **83.97%** |
| Functions | 65 / 67 | **97.01%** |
| Lines | 210 / 236 | **88.98%** |

Files below 100% (all other files with code are at 100%):

| File | Stmts | Branch | Funcs | Lines | Uncovered |
|---|---|---|---|---|---|
| `src/auth/authValidation.ts` | 100 | 91.66 | 100 | 100 | branches at lines 18, 47 (request with no body at all) |
| `src/auth/tokenService.ts` | 92.3 | 87.5 | 100 | 92.3 | line 71 (correctly signed token with a malformed payload) |
| `src/auth/userRepository.ts` | 90 | 75 | 100 | 90 | line 34 (database error other than a duplicate email) |
| `src/errors/errorHandler.ts` | 80 | 50 | 100 | 80 | line 13 (unexpected errors passed on to Express) |
| `src/vehicles/vehicleRepository.ts` | 100 | 95 | 100 | 100 | branch at line 58 (search with no filters) |
| `src/vehicles/vehicleValidation.ts` | 96.82 | 91.54 | 100 | 100 | some validation branches (lines …8, 87, 90–91, 102 as reported) |
| `src/config.ts` | 0 | 0 | 0 | 0 | startup configuration, not tested |
| `src/server.ts` | 0 | 100 | 0 | 0 | startup entry point, not tested |
| `src/db/seedAdmin.ts` | 0 | 0 | 100 | 0 | admin seed script, not tested |

The three startup files account for 23 of the 28 uncovered statements (5 + 4 + 14). `user.ts` and `vehicle.ts` contain only types (0/0 statements).

## Browser verification (not automated tests)

A Playwright script (outside the repository) drove headless Google Chrome through the running frontend (`http://localhost:5173`), which talks to the running backend and the real PostgreSQL database (`car_dealer`). The admin password was read from `backend/.env` inside the script and never printed. All changes were made on a temporary "Demo Tester" vehicle that the script deletes at the end: before and after, the database held the same 8 vehicles and 43 units. Screenshots from this run went to a temporary folder; the screenshots in `docs/screenshots/` come from an earlier run of the same script.

Result: **`RESULT: ALL STEPS PASSED`**, 32 checks (plus 10 screenshot steps):

- **Sign-in page:** the password visibility toggle works; wrong credentials show the real backend's 401 message.
- **Admin:**
  - signed in through the form; hero headline visible
  - real inventory loaded (8 vehicles); price shown in rupees (₹15,00,000)
  - the Corolla (stock 0) shows "Out of stock" with Purchase disabled; Purchase enabled for an in-stock car
  - Edit, Restock and Delete controls visible; stock management table visible
  - filtering by SUV gives 4 vehicles, and sorting high to low starts with the Scorpio-N (₹18,00,000)
  - the Add vehicle form validates before sending
  - added Demo Tester through the real API (9 vehicles); edited its price to ₹5,50,000; restocked it by 1 (stock 2); logged out
- **Regular user:**
  - signed in through the form; no Edit, Restock or Delete controls; no Add vehicle button or management table; no Manage link
  - a purchase through the real API took Demo Tester from 2 to 1 with a success message
  - the Corolla's Purchase button is disabled at zero stock
  - **backend enforcement:** an admin `DELETE` sent with the user's token was refused with 403
- **Responsive layout:** at 820 px wide the inventory grid has 2 columns; at 390 px it has 1 column with no horizontal page overflow.
- **Cleanup (admin):** cancelling the delete dialog keeps the vehicle; confirming deletes Demo Tester (back to 8 vehicles).

Notes on this run:
- The "user: signed in" line is not an independent check (it cannot fail). Sign-in was actually confirmed by the login step waiting for the user's email to appear in the navigation bar.
- The browser console logged three failed requests: the 401 and 403 are the deliberate wrong-password and permission checks above; the 404 is most likely the missing favicon (`/favicon.ico` returns 404 and the app has none), although Chrome's message does not include the URL.

## Known limitations

- **No frontend coverage measurement:** no coverage provider is installed in `frontend/`.
- **Layout is checked in the browser, not by unit tests:** jsdom does not compute CSS layout.
- **Frontend tests use a fake API.** Contract mismatches would only be caught by the browser run against the real backend.
- **Backend startup files are not covered** by automated tests (`config.ts`, `server.ts`, `seedAdmin.ts`); they are exercised whenever the server is started for the browser run.
- **Unexpected server errors** (for example, a lost database connection) go to Express's default handler (`errorHandler.ts` line 13), which responds with HTML rather than the API's JSON error format.
- **No favicon**, which causes the 404 noted above.

## Reproducing

```bash
# once
createdb car_dealer_test
cp backend/.env.test.example backend/.env.test

cd backend
npm install
npm test
npm run typecheck
npm run test:coverage

cd ../frontend
npm install
npm test
npm run build
```
