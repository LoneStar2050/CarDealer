# Test Report

## Summary

All results below are from one verification run on 2026-10-25 at 20:03 IST (Node.js 26.12.1), after adding Favorites, Compare Cars, Vehicle Details and Admin Inventory Statistics.

| Check | Type | Command (directory) | Result |
|---|---|---|---|
| Frontend tests | Automated tests | `npm test` (`frontend/`) | **5 files, 47 tests passed, 0 failed, 0 skipped** (exit 0, 4.56 s) |
| Frontend build | Build | `npm run build` (`frontend/`) | **Passed** (exit 0): `tsc --noEmit` with no errors, then `vite build` |
| Backend tests | Automated tests | `npm test` (`backend/`) | **5 files, 74 tests passed, 0 failed, 0 skipped** (exit 0, 23.86 s) |
| Backend type-check | Type checking | `npm run typecheck` (`backend/`) | **Passed** (exit 0, no errors) |
| Backend coverage | Automated tests + coverage | `npm run test:coverage` (`backend/`) | 74 passed; statements 89.27%, branches 83.97%, functions 97.01%, lines 88.98% (exit 0) |
| Browser: existing workflows | Browser checks | Playwright script, real API + PostgreSQL | **32 checks passed** |
| Browser: new features | Browser checks | Playwright script, real API + PostgreSQL | **23 checks passed** |

**Total automated tests: 121 (47 frontend + 74 backend), all passing.**

- No coverage thresholds are configured, so none can fail.
- Frontend coverage was **not measured**: no coverage provider is installed in `frontend/`.
- **No backend code was changed** for the redesign or the new features: `git diff HEAD -- backend` is empty, there are no untracked files under `backend/`, and the last commit touching `backend/` is `ccad9ec`.

## Frontend automated tests

Vitest 5.0.5 with React Testing Library on jsdom. UI tests render the whole app and use it as a user would. Network calls go to an in-test fake of the API (`src/test/fakeApi.ts`) that copies the real routes, status codes and `{ error }` bodies; each test gets its own copy of the data. The live app always uses the real backend.

| Test file › group | Tests | What it covers |
|---|---|---|
| `format.test.ts` › formatRupees | 4 | Rupee formatting with Indian grouping (₹15,00,000, ₹8,00,000, ₹999, ₹0) |
| `stats.test.ts` › inventoryStats | 2 | Models, units, out-of-stock models and total value (price × quantity); zeros for an empty inventory |
| `favorites.test.ts` › favorites storage | 2 | Only vehicle ids are stored, separately per user; empty list when nothing is stored or the stored value is corrupt or the wrong shape |
| `App.test.tsx` › authentication | 6 | Sign-in; API error for wrong credentials; inline validation that clears when edited; password toggle; expired session (401) returns to sign-in with a message |
| `App.test.tsx` › inventory | 4 | Hero and "Explore Inventory"; cards with category, rupee price, stock and image; load error; empty state |
| `App.test.tsx` › search and filters | 4 | Filters sent as search query parameters; category options from the data; Clear filters; sorting by price and name |
| `App.test.tsx` › purchasing | 3 | Enabled in stock, disabled with "Out of stock" at zero; pending state blocks a second request and stock updates; API error shown |
| `App.test.tsx` › admin controls | 8 | Hidden from regular users; shown to admins; add (validation first, errors clear when corrected), edit, restock, delete with confirmation; backend 403 shown |
| `features.test.tsx` › favorites | 4 | Favorite/unfavorite with button state; Favorites view and count; empty state; stored per user without any token; restored after signing in again |
| `features.test.tsx` › compare cars | 3 | Up to three vehicles, a fourth disabled; comparison table of make, model, category, price and stock; remove and clear; at least two needed |
| `features.test.tsx` › vehicle details | 4 | Details view with image, fields and stock; purchase from details updates stock; back to inventory; own URL (`#vehicle/<id>`) and closing via another link; opening from a `#vehicle/<id>` link; out-of-stock details disables Purchase |
| `features.test.tsx` › admin inventory statistics | 3 | Values calculated from the loaded inventory (3 models, 16 units, 1 out of stock, ₹1,70,00,000); updated after a purchase; not shown to regular users |
| **Total** | **47** | |

The suite also passed when run in random order (`npx vitest run --sequence.shuffle`) during development; that run is not part of this report's run.

Build output: 38 modules transformed; `dist/index.html` 0.43 kB, CSS 29.55 kB (6.24 kB gzip), JS 264.88 kB (79.52 kB gzip).

## Backend automated tests

Integration tests that send real HTTP requests to the Express app with Supertest and run against a real PostgreSQL test database (`car_dealer_test`), reset before each test. `tokenService.test.ts` is a unit test.

| Test file | Tests | What it covers |
|---|---|---|
| `tests/db/migrate.test.ts` | 8 | Schema creation, idempotent migration, unique ids, non-negative price/quantity, role check, unique email |
| `tests/auth/register.test.ts` | 12 | Registration: 201 shape, bcrypt hashing, no password data, no self-assigned admin; 400 validation; 409 duplicate email |
| `tests/auth/login.test.ts` | 7 | Login: JWT with verified `sub`, `role`, `exp`; no password data; identical 401s for wrong password and unknown email; 400 for missing fields |
| `tests/auth/tokenService.test.ts` | 7 | Token lifetime handling and rejection of lifetimes without a unit |
| `tests/vehicles/vehicles.test.ts` | 40 | 401/403 protection; admin-only create, update, delete, restock; listing; search and filters; 400 validation; 404; purchase decrements and returns 409 at zero; concurrent purchases of the last unit give exactly one success |
| **Total** | **74** | |

## Backend coverage

From `npm run test:coverage` (V8 provider, `backend/src/**/*.ts`). Unchanged from the previous report, as expected with no backend changes.

| Metric | Covered | % |
|---|---|---|
| Statements | 233 / 261 | **89.27%** |
| Branches | 131 / 156 | **83.97%** |
| Functions | 65 / 67 | **97.01%** |
| Lines | 210 / 236 | **88.98%** |

Files below 100% (all other files with code are at 100%):

| File | Stmts | Branch | Funcs | Lines | Uncovered |
|---|---|---|---|---|---|
| `src/auth/authValidation.ts` | 100 | 91.66 | 100 | 100 | branches at lines 18, 47 (request with no body) |
| `src/auth/tokenService.ts` | 92.3 | 87.5 | 100 | 92.3 | line 71 (signed token with a malformed payload) |
| `src/auth/userRepository.ts` | 90 | 75 | 100 | 90 | line 34 (database error other than a duplicate email) |
| `src/errors/errorHandler.ts` | 80 | 50 | 100 | 80 | line 13 (unexpected errors passed to Express) |
| `src/vehicles/vehicleRepository.ts` | 100 | 95 | 100 | 100 | branch at line 58 (search with no filters) |
| `src/vehicles/vehicleValidation.ts` | 96.82 | 91.54 | 100 | 100 | some validation branches (lines …8, 87, 90–91, 102 as reported) |
| `src/config.ts` | 0 | 0 | 0 | 0 | startup configuration, not tested |
| `src/server.ts` | 0 | 100 | 0 | 0 | startup entry point, not tested |
| `src/db/seedAdmin.ts` | 0 | 0 | 100 | 0 | admin seed script, not tested |

The three startup files account for 23 of the 28 uncovered statements (5 + 4 + 14).

## Browser checks (not automated tests)

Two Playwright scripts (kept outside the repository) drove headless Google Chrome through the running frontend (`http://localhost:5173`), connected to the running backend and the real PostgreSQL database (`car_dealer`). The admin password was read from `backend/.env` inside the scripts and never printed. Every change was made on a temporary "Demo Tester" vehicle that each script deletes at the end. Before and after both runs the database held 8 models, 42 units, 1 out-of-stock model and a total value of ₹5,12,00,000. Screenshots from these runs went to a temporary folder; `docs/screenshots/` was unchanged (same checksum before and after).

Before the browser runs, `GET /api/vehicles` (the data behind the statistics) returned **401** both without a token and with an invalid token.

### Run 1: existing workflows (`RESULT: ALL STEPS PASSED`, 32 checks)

- **Sign-in page:** password visibility toggle; wrong credentials show the real 401 message.
- **Admin:**
  - hero visible; 8 vehicles loaded; ₹15,00,000 formatting
  - the out-of-stock Corolla shows "Out of stock" with Purchase disabled; Purchase enabled for an in-stock car
  - Edit, Restock and Delete controls and the stock table visible
  - SUV filter gives 4 vehicles, and sorting high to low starts with the Scorpio-N
  - add form validates first; added, edited (₹5,50,000) and restocked (to 2) the test vehicle through the real API
- **Regular user:**
  - no Edit, Restock, Delete, Add vehicle, management table or Manage link
  - purchase through the real API took stock from 2 to 1
  - Corolla Purchase disabled at zero
  - an admin `DELETE` with the user's token was refused with **403**
- **Responsive layout:** 2 columns at 820 px; 1 column at 390 px with no horizontal overflow.
- **Cleanup (admin):** cancelling the delete keeps the vehicle; confirming deletes it.

### Run 2: new features (`RESULT: ALL STEPS PASSED`, 23 checks, no page errors)

- **Admin statistics:**
  - Vehicle models 8, Units in stock 42, Out-of-stock models 1 and Total inventory value ₹5,12,00,000, each matching values calculated directly in PostgreSQL
  - after adding the test vehicle: +1 model and +2 units
  - after deleting it: back to the original values
- **Regular user, statistics:** no inventory statistics shown.
- **Favorites:** two favorited cars shown in the Favorites view; stored per user as two vehicle ids only (no token or password); still there after a page reload; unfavoriting updates the count.
- **Compare:** "3 of 3 selected"; a fourth vehicle cannot be added; the comparison table shows the real prices (₹15,00,000, ₹8,00,000, ₹13,00,000); Clear comparison removes the tray.
- **Vehicle details:**
  - shows the test vehicle with stock 2; purchase from details through the real API gives stock 1 with a success message
  - back to inventory shows the updated stock
  - the details view has its own URL (`#vehicle/<id>`), and the navbar's Inventory link and the browser's Back button both leave it
  - out-of-stock details disable Purchase
  - no horizontal overflow at 390 px

### Notes on the browser runs

- The "user: signed in" line in run 1 cannot fail on its own; sign-in is confirmed by the login step waiting for the user's email in the navigation bar.
- The "own URL" check in run 2 only confirms that the address has the form `#vehicle/<id>`. The exact id (`#vehicle/v1`) is checked by the frontend unit test.
- Run 1's browser console showed three failed requests: the 401 and 403 are the deliberate wrong-password and permission checks; the 404 is most likely the missing favicon (`/favicon.ico` returns 404 and the app has none), although Chrome's message does not include the URL.

## Security notes on the new features

- **Admin statistics** are rendered only for admins. They are calculated from `GET /api/vehicles`, which requires a valid JWT. Regular users can already see the same price and stock data in the vehicle list, so a separate admin-only statistics endpoint would not add protection. The statistics are simply not offered to regular users.
- **Favorites** are stored in the browser's local storage under `dealership-favorites:<userId>` and contain only vehicle ids.

## Known limitations

- **No frontend coverage measurement:** no coverage provider is installed in `frontend/`.
- **Frontend tests use a fake API.** Contract mismatches would only be caught by the browser runs against the real backend.
- **Layout is checked in the browser, not by unit tests:** jsdom does not compute CSS layout.
- **Favorites are kept in this browser only.** They don't follow the user to another browser or device. Ids of deleted vehicles stay in storage but are ignored in counts and views.
- **Logging out on a details page keeps `#vehicle/<id>` in the address,** so the next sign-in opens that vehicle's details.
- **Backend startup files** (`config.ts`, `server.ts`, `seedAdmin.ts`) are not covered by automated tests.
- **Unexpected server errors** go to Express's default handler, which responds with HTML rather than the API's JSON error format.
- **No favicon.**

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
