# Test Report

## Summary

Results from the verification run on **2026-10-26** (Node.js 26.12.1, PostgreSQL 17.11, Google Chrome 155), after adding reviews and ratings, purchase history, invoices, advanced vehicle discovery, admin analytics and the comparison improvements, and after the fix commit `046c017`. Unit tests, type checks and the build ran at 03:00 IST; the final end-to-end run started at 03:05:00 IST. The frontend test row was updated at about 04:25 IST, after the stale-stock regression test (`2c20a95`, `49eda16`) and the test-stability fix (`1ecc812`).

| Check | Type | Command (directory) | Result |
|---|---|---|---|
| Backend tests | Unit + API integration tests | `npm run test:coverage` (`backend/`) | **180 / 180 passed** in 11 files, 0 failed, 0 skipped (exit 0, 62.78 s) |
| Backend coverage | Coverage | same run | statements 93.87%, branches 89.62%, functions 98.41%, lines 93.70% |
| Backend type check | Type checking | `npm run typecheck` (`backend/`) | **Passed** (exit 0, no errors) |
| Frontend tests | Component tests | `npx vitest run` (`frontend/`, same as `npm test`) | **88 / 88 passed** in 10 files, 0 failed, 0 skipped, in each of 10 consecutive runs (exit 0, 6.17–10.78 s per run) |
| Frontend type check | Type checking | `npx tsc --noEmit` (`frontend/`) | **Passed** (exit 0, no errors) |
| Frontend build | Build | `npm run build` (`frontend/`) | **Passed** (exit 0): `tsc --noEmit`, then `vite build` |
| End-to-end | Browser checks | `npm test` (`e2e/`, runs `./run.sh`) | **28 passed, 0 failed** (exit 0) |
| Lint | — | — | **Not run.** Neither `frontend/` nor `backend/` has a lint script |

**Total automated unit and integration tests: 268 (180 backend + 88 frontend), all passing.**

- No coverage thresholds are configured, so none can fail.
- Frontend coverage was **not measured**: no coverage provider is installed in `frontend/`.

## Disclosure: the two latest UI fixes have no Red-Green evidence

Commit `046c017` ("fix: stop analytics overflow on phones and add a favicon") changed two things:

1. `min-w-0` on the "Top-selling vehicles" card of the analytics dashboard. At 390 px the card grew to 400 px, because its table has `min-w-[360px]` and grid items default to `min-width: auto`. The page could then be scrolled sideways.
2. A favicon (`frontend/public/favicon.svg`, linked from `index.html`). Without one, Chrome's automatic request for `/favicon.ico` returned 404 and logged "Failed to load resource" in the console.

**No test was observed failing before these fixes in a Red-Green cycle.** There is no unit test for either change, because jsdom (used by the frontend tests) does not compute CSS layout and does not request favicons. Both problems were found by the end-to-end run, and the end-to-end checks are the only verification:

| End-to-end run | Result |
|---|---|
| Before the fixes | 26 passed, 2 failed: `#analytics overflows by 26px` at 390 px; console error "Failed to load resource: the server responded with a status of 404 (Not Found)" |
| After the `min-w-0` change | 27 passed, 1 failed: the console error remained. Logging the console message's location identified the URL as `http://localhost:5180/favicon.ico` |
| After adding the favicon | 28 passed, 0 failed |

These checks failed and then passed, but they were not written as failing tests before the fixes. So the fixes do **not** have demonstrated Red-Green evidence of the kind the rest of the history has.

## Frontend automated tests

Vitest 5.0.5 with React Testing Library on jsdom. UI tests render the whole app and use it as a user would. Network calls go to an in-test fake of the API (`src/test/fakeApi.ts`) that copies the real routes, status codes and `{ error }` bodies; each test gets its own copy of the data. The live app always uses the real backend.

| Test file › group | Tests | What it covers |
|---|---|---|
| `format.test.ts` › formatRupees | 4 | Rupee formatting with Indian grouping (₹15,00,000, ₹8,00,000, ₹999, ₹0) |
| `stats.test.ts` › inventoryStats | 2 | Models, units, out-of-stock models and total value; zeros for an empty inventory |
| `favorites.test.ts` › favorites storage | 2 | Only vehicle ids are stored, separately per user; empty list for missing, corrupt or wrong-shape data |
| `App.test.tsx` › authentication | 6 | Sign-in; API error for wrong credentials; inline validation; password toggle; expired session returns to sign-in |
| `App.test.tsx` › inventory | 4 | Hero; cards with category, rupee price, stock and image; load error; empty state |
| `App.test.tsx` › search and filters | 4 | Filters sent to the search endpoint; category options; Clear filters; sorting by price and name |
| `App.test.tsx` › purchasing | 4 | Enabled in stock, disabled at zero; pending state blocks a second request; API error shown; after a 409 for a vehicle that sold out since the page loaded, the card refreshes to "Out of stock" with Purchase disabled and the error stays |
| `App.test.tsx` › admin controls | 8 | Hidden from regular users; add (with validation), edit, restock, delete with confirmation; backend 403 shown |
| `features.test.tsx` | 14 | Favorites (4), compare cars (3), vehicle details with its own URL (4), admin inventory statistics (3) |
| `reviews.test.tsx` | 9 | Rating and count on cards; loading, empty, error and loaded states of the reviews; submitting a review updates the summary and the card; rating and comment validated before sending; server rejection shown; no form after the user has reviewed |
| `orders.test.tsx` | 10 | "My orders" link; loading, empty, error and expired-session states; orders newest first with details; a new order appears; invoice download with the user's token, and its error; quantity selection limited to the stock |
| `discovery.test.tsx` | 6 | Newest-first and top-rated sorting (ties by review count, unrated last); availability filter sent to the API; combined filters; Clear filters resets them; an inverted price range is explained instead of searched |
| `analytics.test.tsx` | 10 | Analytics link for admins only; figures from the API after a loading state; inclusive date filter; start after end rejected without calling the API; empty and error states; regular users see "Access denied" and nothing is requested; 403 from the server shown as access denied; expired session |
| `compare.test.tsx` | 5 | Availability, rating and listing date with fallbacks for missing values; lowest price and best rating highlighted; Remove inside the table; closes below two vehicles; focus moves into the dialog and back to the Compare button on Escape |
| **Total** | **88** | |

**Stability.** Before `1ecc812`, 2 of 8 consecutive full runs failed intermittently: four tests checked a short-lived pending state after an awaited click while relying on a 20–50 ms fake API delay, and some whole-app tests exceeded Vitest's 5 s timeout when the machine was busy (up to 5.06 s, at a load average of 23–48). The fake API now holds those requests until the test releases them, and `testTimeout` is 15 s. No assertion was removed or weakened. After the fix, 10 consecutive full runs each passed 88 / 88.

Build output: `dist/index.html` 0.49 kB, CSS 32.52 kB (6.75 kB gzip), JS 288.78 kB (85.30 kB gzip).

## Backend automated tests

Integration tests that send real HTTP requests to the Express app with Supertest and run against a real PostgreSQL test database (`car_dealer_test`), reset before each test. `tokenService.test.ts` is a unit test.

| Test file | Tests | What it covers |
|---|---|---|
| `tests/db/migrate.test.ts` | 20 | Schema and idempotent migration; vehicle and user constraints; reviews table (rating 1–5, one review per user and vehicle, foreign keys); purchases table (automatic unique order numbers, quantity > 0, total = unit price × quantity, foreign key to users) |
| `tests/auth/register.test.ts` | 12 | Registration: 201 shape, bcrypt hashing, no password data, no self-assigned admin; 400 validation; 409 duplicate email |
| `tests/auth/login.test.ts` | 7 | JWT with verified `sub`, `role`, `exp`; identical 401s for wrong password and unknown email; 400 for missing fields |
| `tests/auth/tokenService.test.ts` | 7 | Token lifetime handling and rejection of lifetimes without a unit |
| `tests/errors/errorResponses.test.ts` | 1 | Malformed JSON gets 400 with the standard JSON error shape and no stack trace |
| `tests/vehicles/vehicles.test.ts` | 40 | 401/403 protection; admin-only create, update, delete, restock; listing; search; 400 validation; 404; purchase at zero returns 409; concurrent purchases of the last unit give exactly one success |
| `tests/vehicles/discovery.test.ts` | 18 | Listing timestamps; sorting by price, newest and rating (ties by review count, unrated last); availability filter; combined filters; empty results; 400 for unknown sort/availability values (including an SQL-injection attempt); `%`, `_` and SQL text treated literally |
| `tests/reviews/reviews.test.ts` | 30 | 401 without a valid token; 201 with the new summary; author from the token, not the body; 400 for invalid ratings and comments (missing, 0, 6, fractional, text, blank, over 1,000 characters), with nothing stored; 409 for a second review, and only one of two simultaneous reviews accepted; 404 for unknown vehicles; reviews newest first, average rounded to one decimal, `isOwn`, no full emails or user ids; ratings in the vehicle list; reviews deleted with their vehicle |
| `tests/purchases/purchases.test.ts` | 25 | Default one unit; multi-unit orders; price, total and buyer derived on the server, ignoring client values; increasing invoice numbers; 400 for invalid quantities with nothing changed; 409 for insufficient or zero stock; 404 for unknown vehicles; no overselling with many simultaneous single- or multi-unit orders; rollback with a generic 500 when recording the order fails; orders keep their price after the vehicle is repriced or deleted; order history only for the owner, newest first; 404 for another user's order; 400 for a malformed id |
| `tests/purchases/invoices.test.ts` | 6 | UTF-8 text attachment named after the invoice number; contents (invoice number, order reference, date, buyer, vehicle, quantity, unit price, total); still available after the vehicle is deleted; 404 for another user's invoice, including an admin's request; 404 unknown, 400 malformed; 401 without a valid token |
| `tests/admin/analytics.test.ts` | 14 | 401 without a valid token and 403 for regular users; zeros for no data; inventory and sales calculated from stored rows; at most five top sellers; sales of deleted vehicles still counted; inclusive UTC date range, open-ended ranges, inventory not filtered by date; 400 for invalid dates and inverted ranges |
| **Total** | **180** | |

## Backend coverage

From `npm run test:coverage` (V8 provider, `backend/src/**/*.ts`).

| Metric | Covered | % |
|---|---|---|
| Statements | 429 / 457 | **93.87%** |
| Branches | 216 / 241 | **89.62%** |
| Functions | 124 / 126 | **98.41%** |
| Lines | 387 / 413 | **93.70%** |

Files below 100% (all other files are at 100%; the coverage report shortens some file names, completed here from the directory):

| File | Stmts | Branch | Funcs | Lines | Uncovered |
|---|---|---|---|---|---|
| `src/config.ts` | 0 | 0 | 0 | 0 | startup configuration, not tested |
| `src/server.ts` | 0 | 100 | 0 | 0 | startup entry point, not tested |
| `src/db/seedAdmin.ts` | 0 | 0 | 100 | 0 | admin seed script, not tested |
| `src/auth/…Validation.ts` | 100 | 91.66 | 100 | 100 | branches at lines 18, 47 |
| `src/auth/tokenService.ts` | 92.3 | 87.5 | 100 | 92.3 | line 71 |
| `src/auth/…Repository.ts` | 88.88 | 75 | 100 | 88.88 | line 32 |
| `src/reviews/…Repository.ts` | 94.11 | 83.33 | 100 | 93.33 | line 59 |
| `src/reviews/…Validation.ts` | 100 | 92.85 | 100 | 100 | branch at line 6 |
| `src/vehicles/…Validation.ts` | 97.18 | 92.4 | 100 | 100 | some validation branches (lines …, 96, 99–100, 111 as reported) |

## End-to-end checks

### Setup

- **Tooling:** `e2e/e2e.mjs`, a Playwright (`playwright-core` 1.64.1) script with its own small pass/fail runner, driving installed Google Chrome in **headless** mode.
- **Frontend:** the **production build** (`frontend/dist`, built by `npm run build` at the start of each run), served by `e2e/serve.mjs` on port 5180 with `/api` proxied to the API.
- **Backend:** the **real API** (`backend/src/server.ts`) on port 3100, with a random `JWT_SECRET` generated for each run.
- **Database:** the separate PostgreSQL database **`car_dealer_e2e`**. Before each run it was **wiped and reseeded**: `run.sh` drops and recreates it and seeds only a test admin, and refuses any database name that does not end in `_e2e`. The earlier runs, made before `run.sh` existed, used the same steps by hand (`dropdb`/`createdb`, or `TRUNCATE … CASCADE`, then the admin seed). The production **`car_dealer` database was not touched**: no E2E process was given its connection string. The developer's own servers on ports 3000 and 5173 were not used.
- **Test data:** all vehicles, accounts, reviews and orders are created by the script through the API and the UI. After the final run the E2E database held 3 users, 3 vehicles, 5 orders and 1 review.

### Final run (2026-10-26 03:05:00 IST, exit 0)

Output of `npm test` in `e2e/`, as printed:

```
PASS  1. register a new account through the UI and land on the inventory
PASS  1b. log out and log back in through the sign-in form
PASS  2. search by make returns only matching vehicles
PASS  2b. availability filter "Out of stock" shows only the Swift (server-side)
PASS  2c. inverted price range is explained inline and nothing is searched
PASS  2d. out-of-stock vehicle has Purchase disabled
PASS  3. open vehicle details (own URL)
PASS  4. submit a review; it is stored and the summary updates
PASS  4b. the form is gone after reviewing and a second review is refused by the API
PASS  5. buy 2 units from the details page and see the order confirmation
PASS  6. inventory decreased by 2 in the UI and in the database
PASS  6b. asking for more than the stock is blocked in the UI and refused by the API
PASS  7. purchase history lists the order with its details
PASS  7b. invoice downloads as a text file with the order details
PASS  8. a regular user sees Access denied at #analytics and the API answers 403
PASS  8b. missing or forged tokens get 401; another user cannot see the order or invoice (404)
PASS  10. favorites and comparison (with ratings) still work
PASS  10b. sorting by "Top rated" puts the reviewed Creta first
PASS  10c. a one-click card purchase still decrements stock by one
PASS  9. admin signs in and adds a vehicle through the dialog
PASS  9b. admin restocks the out-of-stock Swift
PASS  9c. admin delete asks for confirmation; Cancel keeps, Delete removes
PASS  9d. analytics dashboard shows figures from the stored orders
PASS  9e. analytics date filter: a future range has no sales; All time restores
PASS  concurrency: 6 simultaneous single-unit purchases of 3 units -> exactly 3 succeed
PASS  responsive: no horizontal scrolling on phone (390px) for inventory, orders and analytics
PASS  responsive: no horizontal scrolling on tablet (820px) for inventory, orders and analytics
PASS  no console errors in the browser

28 passed, 0 failed
```

The checks are numbered after the workflows they cover: (1) register and log in, (2) browse and search, (3) vehicle details, (4) review, (5) purchase, (6) inventory decreases, (7) purchase history and invoice, (8) protected resources, (9) admin inventory management and analytics, (10) existing features. They run in the order above because the buyer's checks share one browser session.

Notable assertions:
- **4:** the stored review is read back through the API, and the response must not contain the buyer's full email.
- **6 / 6b:** stock is compared with the API, not just the UI. A request for too many units that also sends `unitPrice: 1` gets `409 "Only 3 units in stock"`.
- **7b:** the downloaded file is read and must contain the invoice number, buyer email, vehicle, quantity, unit price and total.
- **8:** a regular user gets `403` for analytics, create, delete and restock.
- **8b:** an admin also gets `404` for a buyer's invoice.
- **9d:** the analytics figures are checked against the known orders (₹47,00,000 revenue, 2 orders, 3 units sold, 7 units in stock).

### Run history

| Run | Result | Notes |
|---|---|---|
| First run, before `046c017` | 26 passed, 2 failed | Phone overflow on `#analytics`, favicon 404 (see the disclosure above) |
| After the `min-w-0` change | 27 passed, 1 failed | Favicon 404 only |
| After adding the favicon | 28 passed, 0 failed | Script still outside the repository |
| `e2e/` run through `run.sh` (03:03 IST) | 28 passed, 0 failed | Port 3100 was still listening right after the run, because `npx` starts the API as a child process that the cleanup did not stop directly. That process had exited by the time it was checked again. `run.sh` now starts the API with `node --import tsx`, so the cleanup stops it directly |
| `run.sh` with that change (03:04 IST) | 28 passed, 0 failed | Ports 3100 and 5180 free afterwards. A defect in `reviews.png` was found (see Screenshots) |
| Final run (03:05 IST) | 28 passed, 0 failed | Ports 3100 and 5180 confirmed free afterwards |

### Screenshots

The final run saved `reviews.png`, `orders.png`, `access-denied.png`, `compare-ratings.png`, `inventory-ratings.png`, `analytics.png` (desktop, 1366 px), `mobile-filters.png` and `mobile-analytics.png` (390 px) to `docs/screenshots/`. Each was opened and checked after the run. These files were later removed from the repository (`c32c549`); the README now shows the author's own screenshots from `screenshot/`.

The 03:04 run's `reviews.png` showed the fixed navigation bar drawn in the middle of the page, because the full-page capture was taken while scrolled. The script now scrolls to the top before that capture.

The phone screenshot of the analytics dashboard shows the top-selling table scrolling sideways inside its card, which is the intended behaviour after the fix. Its figures are higher than in the desktop screenshot because it is captured later, after the concurrency check's orders.

## Security notes

- **Admin analytics** are protected on the server (`authenticate` + `requireAdmin` on every `/api/admin` route). The frontend hides the link and shows "Access denied", but does not rely on that.
- **Orders and invoices** are looked up by order id *and* the caller's user id, so other users' orders, including for admins, are indistinguishable from unknown ids (404).
- **Prices, totals and buyers** are always taken from the database and the token. Client-supplied values are ignored, which is covered by both backend tests and E2E check 6b.
- **Reviews** expose only a masked email (`b***@example.com`) and an `isOwn` flag, never user ids.
- **Search** uses parameterized queries; sort orders come from a fixed list; `%` and `_` in text filters are escaped.
- **Unexpected errors** are logged on the server and answered with a generic `500 { "error": "Internal server error" }`.
- **Favorites** are stored in the browser's local storage under `dealership-favorites:<userId>` and contain only vehicle ids.

## Known limitations

- **No lint step:** neither package has a lint script, so lint was not run.
- **No frontend coverage measurement:** no coverage provider is installed in `frontend/`.
- **Frontend tests use a fake API.** Contract mismatches are only caught by the end-to-end run against the real backend.
- **Layout is checked only in the browser.** jsdom does not compute CSS layout, so responsive behaviour is verified by the E2E checks and screenshots, not by unit tests.
- **The E2E script is not a test framework.** It has its own pass/fail runner, requires Google Chrome to be installed, and its checks depend on running in order.
- **Analytics dates are UTC calendar days.** An order placed shortly after midnight IST falls on the previous UTC day.
- **Favorites are kept in this browser only.** Ids of deleted vehicles stay in storage but are ignored.
- **Logging out on a details page keeps `#vehicle/<id>` in the address,** so the next sign-in opens that vehicle's details.
- **Backend startup files** (`config.ts`, `server.ts`, `seedAdmin.ts`) are not covered by automated tests.

## Reproducing

```bash
# once
createdb car_dealer_test
cp backend/.env.test.example backend/.env.test

cd backend
npm install
npm run typecheck
npm run test:coverage

cd ../frontend
npm install
npx tsc --noEmit
npm test
npm run build

cd ../e2e
npm install
npm test          # recreates car_dealer_e2e; never touches car_dealer
```
