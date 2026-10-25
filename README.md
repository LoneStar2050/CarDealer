# Car Dealership Inventory System

A full-stack inventory system built for the Incubyte TDD kata. Users register and log in, browse, search, filter and sort the dealership's vehicles, read and write reviews, buy one or more units, and see their order history with downloadable invoices. Admins also add, edit, delete and restock vehicles and see a sales and inventory analytics dashboard.

- **Backend:** Node.js, TypeScript, Express 5, PostgreSQL, JWT authentication, bcrypt password hashing
- **Frontend:** React 19, TypeScript, Tailwind CSS, Vite
- **Tests:** Vitest and Supertest against a real PostgreSQL test database (backend); Vitest and React Testing Library (frontend); a Playwright script driving headless Google Chrome against the production build, the real API and an isolated database (end-to-end)

## Features

**Authentication**
- Register with an email and a password of at least 8 characters. New accounts are always regular users; a client cannot make itself an admin.
- Log in to receive a JWT (`Authorization: Bearer <token>`), signed with HS256 and carrying the user id and role.
- Wrong passwords and unknown emails get the same `401` response, so the API does not reveal which emails are registered.

**Vehicles** (every vehicle has a unique id, make, model, category, price, quantity in stock, listing date and rating summary)
- List all vehicles, including out-of-stock ones.
- Search by make, model or category (partial, case-insensitive, and literal: `%` and `_` are not treated as wildcards), by an inclusive price range, and by availability (in stock / out of stock). Filters can be combined.
- Sort by price (low to high, high to low), newest listing, or top rated. Only these fixed sort orders reach the SQL, and all values are passed as query parameters.
- An inverted price range (min above max) is rejected with `400` by the API and explained inline by the frontend.
- Admins only: add, update, delete and restock vehicles.

**Purchases and orders**
- Buy 1 to 100 units of a vehicle in one order. The buyer comes from the token and the price from the database; any price, total or user id sent by the client is ignored.
- Stock is reserved and the order is recorded in one database transaction. A conditional `UPDATE` locks the vehicle row, so simultaneous purchases can never oversell (stock never goes below zero). Asking for more than is in stock returns `409` with the number available.
- Each order stores the vehicle's make, model, category and unit price at purchase time, the quantity, the total (enforced by a database check: total = unit price × quantity) and the purchase timestamp. Orders keep their details if the vehicle is later repriced or deleted.
- **Purchase history:** users see only their own orders. Another user's order id returns `404`, the same as an unknown id.
- **Invoices:** a plain-text invoice download for each order, with an invoice number (`INV-000001`), order reference, purchase date, buyer email, vehicle, quantity, unit price and total. Only the buyer can download it (others get `404`), and it is sent with `Cache-Control: no-store`.

**Reviews and ratings**
- Logged-in users can review a vehicle once, with a whole-number rating from 1 to 5 and a comment of up to 1,000 characters. A second review by the same user is refused with `409`, enforced by a unique database constraint.
- Reviewers are shown with a masked email (`b***@example.com`); the API never returns their id or full email.
- Average rating (one decimal) and review count are returned with every vehicle and shown on vehicle cards, the details page and the comparison table.

**Admin analytics** (`/api/admin/analytics`, admin only: `401` without a token, `403` for regular users)
- Sales for an optional inclusive date range (`from`, `to` as `YYYY-MM-DD`): revenue, order count, units sold and the top five vehicles by units sold.
- Current inventory: vehicle models, units in stock, inventory value (price × quantity) and the list of out-of-stock vehicles.
- All figures are calculated from the stored orders and vehicles; nothing is hard-coded.

**Frontend** ("Prestige Motors")
- Sign-in and registration pages with inline validation, a password show/hide toggle and loading states.
- A hero section and an inventory grid of vehicle cards showing an illustration (chosen by category, with a fallback if it fails to load), make, model, category, rating, price in rupees (e.g. ₹15,00,000) and stock.
- Filters for make, model, category, availability and price range, sorting (featured, newest, top rated, price low to high or high to low, name A to Z), Clear filters, and a count of matching vehicles. On phones the filters stack in a single column.
- A Purchase button on every vehicle, disabled with an "Out of stock" label at zero; it shows a pending state, ignores repeated clicks and updates the stock from the server's response.
- **Vehicle details:** a dedicated view (URL `#vehicle/<id>`, so it can be linked and the Back button works) with the image, all fields, rating, stock status, a quantity selector with a running total (blocked above the available stock), and customer reviews with a star-rating review form.
- **My orders:** purchase history (`#orders`) with invoice number, quantity, unit price, total and order reference for each order, a "Download invoice" button, and loading, empty and error states. A successful purchase shows a confirmation with the invoice number.
- **Favorites:** a heart on each vehicle saves it to a per-user favorites list (kept in this browser's local storage; only vehicle ids are stored, never tokens or passwords), with an "All vehicles / Favorites" switch.
- **Compare:** select up to three vehicles and compare make, model, category, price, stock, availability, rating and listing date side by side. Missing values read "No reviews yet" or "—". The lowest price gets a "Lowest price" badge and the best rating is highlighted. Each vehicle has a Remove button.
- **Dialogs** move focus inside when opened, close with Escape and return focus to the button that opened them.
- Admins only: Add/Edit vehicle dialogs with validation, a Restock dialog with a quantity input, Delete with a confirmation dialog, a stock management table, inventory statistics, and the **Analytics** dashboard (`#analytics`) with a date filter. Regular users who open `#analytics` see an "Access denied" page, and the API refuses them as well.
- Success and error messages for every action; an expired session returns to the sign-in page with an explanation.
- Responsive layout for phone, tablet and desktop. Wide tables (such as top-selling vehicles on a phone) scroll sideways inside their own card instead of widening the page.

Errors are returned as JSON: `{ "error": "<message>" }`. Malformed JSON bodies get `400`, and unexpected errors get a generic `500` without internal details.

## Project structure

```
backend/    Express API (src/), tests (tests/), env templates
frontend/   React single-page app (src/), Vite config with an /api proxy
e2e/        End-to-end browser checks (run.sh, e2e.mjs) and a small static server for the production build
docs/       Screenshots of the running application
```

## Prerequisites

- Node.js and npm (developed with Node.js 26.12 and npm 11.20)
- PostgreSQL (developed with PostgreSQL 17), running locally on port 5432, with `createdb` / `dropdb` on the `PATH`
- Google Chrome, only for the end-to-end checks (run with Chrome 155)

## Setup

### 1. Create the databases

One database for the app and a separate one for the tests. The test database name must end in `_test`: the test suite refuses to run otherwise, because it drops and truncates its tables.

```bash
createdb car_dealer
createdb car_dealer_test
```

The tables (`users`, `vehicles`, `reviews`, `purchases`) are created automatically: the server and the admin seed script run an idempotent migration (`CREATE TABLE IF NOT EXISTS`) on startup, and the tests do the same.

### 2. Configure the backend

```bash
cd backend
npm install
cp .env.example .env
cp .env.test.example .env.test
```

Edit `backend/.env`:

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string, e.g. `postgres://localhost:5432/car_dealer` |
| `JWT_SECRET` | yes | Secret used to sign tokens; use a long random value (e.g. `openssl rand -hex 32`) |
| `JWT_EXPIRES_IN` | no (default `1h`) | Token lifetime with a unit, e.g. `15m`, `1h`, `7d`; a bare number is rejected at startup |
| `PORT` | no (default `3000`) | API port. The frontend proxy expects `3000`. |
| `ADMIN_EMAIL` | for seeding | Email of the admin account created by `npm run seed:admin` |
| `ADMIN_PASSWORD` | for seeding | Admin password, at least 8 characters |

`backend/.env.test` holds the same variables for the test suite; its `DATABASE_URL` must point to a database whose name ends in `_test`.

`.env` and `.env.test` are git-ignored; only the `*.example` templates are committed. If your PostgreSQL needs a username or password, put them in the URL: `postgres://user:password@localhost:5432/car_dealer`.

### 3. Create the admin account

Registration can never create an admin, so the admin comes from a seed script. It creates the account from `ADMIN_EMAIL` / `ADMIN_PASSWORD`, or promotes and resets it if it already exists:

```bash
cd backend
npm run seed:admin
```

### 4. Start the backend

```bash
cd backend
npm run dev      # restarts on file changes
# or
npm start
```

The API listens on `http://localhost:3000`.

### 5. Start the frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the URL Vite prints (by default `http://localhost:5173`). In development, Vite proxies `/api` requests to `http://localhost:3000`, so the backend must be running.

Normal users create their own accounts: on the login screen, choose **"Create an account"**, enter an email and a password of at least 8 characters, and you are logged in as a regular user. Admins log in with the account created by `npm run seed:admin`.

## Running the tests

### Backend: unit and integration tests, type check

```bash
cd backend
npm test                # all backend tests (needs backend/.env.test and the _test database)
npm run test:coverage   # tests with a coverage report
npm run typecheck       # TypeScript checks for src/ and tests/
```

### Frontend: component tests, type check, build

```bash
cd frontend
npm test              # Vitest + React Testing Library (an in-test fake of the API, no server needed)
npx tsc --noEmit      # type check
npm run build         # type check, then the production build
```

### End-to-end checks

```bash
cd e2e
npm install           # installs playwright-core (uses your installed Google Chrome; no browser download)
npm test              # runs ./run.sh
```

`run.sh`:
1. drops and recreates the database `car_dealer_e2e` (it refuses any name that does not end in `_e2e`), then seeds a test admin. Your `car_dealer` database is never touched.
2. builds the frontend for production.
3. starts the API on port 3100 with a random, run-only `JWT_SECRET`, and serves `frontend/dist` on port 5180 with `/api` proxied to the API. These ports do not clash with the dev servers on 3000 and 5173.
4. runs `e2e.mjs` in headless Chrome, then stops both servers.

It saves screenshots to `docs/screenshots/` (see below). Settings can be overridden with environment variables: `E2E_DB`, `E2E_DATABASE_URL`, `E2E_API_PORT`, `E2E_FRONTEND_PORT`, `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, `E2E_SCREENSHOT_DIR`.

There is no lint script in either package, so no linter is run.

### Current results

Run on 2026-10-26 (Node.js 26.12.1). Details are in [TEST_REPORT.md](TEST_REPORT.md).

| Check | Result |
|---|---|
| Backend tests (`backend/`, `npm run test:coverage`) | **180 / 180 passed** in 11 files; statement coverage 93.87% |
| Backend type check (`npm run typecheck`) | **Passed** |
| Frontend tests (`frontend/`, `npm test`) | **87 / 87 passed** in 10 files |
| Frontend type check (`npx tsc --noEmit`) and build (`npm run build`) | **Passed** |
| End-to-end (`e2e/`, `npm test`) | **28 / 28 checks passed**, 0 failed (final run 03:05 IST) |
| Lint | **Not run**: no lint script exists |

## API

All routes except `/api/auth/*` require `Authorization: Bearer <token>` from the login endpoint. Missing or invalid tokens get `401`; non-admins calling admin routes get `403`.

| Method | Route | Access | Body / query | Success |
|---|---|---|---|---|
| POST | `/api/auth/register` | Public | `{ email, password }` | `201 { user }` |
| POST | `/api/auth/login` | Public | `{ email, password }` | `200 { token, user }` |
| GET | `/api/vehicles` | Logged in | — | `200 { vehicles }` |
| GET | `/api/vehicles/search` | Logged in | query (all optional): `make`, `model`, `category`, `minPrice`, `maxPrice`, `availability` (`in_stock` \| `out_of_stock`), `sort` (`price_asc` \| `price_desc` \| `newest` \| `rating`) | `200 { vehicles }` |
| POST | `/api/vehicles` | Admin | `{ make, model, category, price, quantity }` | `201 { vehicle }` |
| PUT | `/api/vehicles/:id` | Admin | any of `make`, `model`, `category`, `price`, `quantity` | `200 { vehicle }` |
| DELETE | `/api/vehicles/:id` | Admin | — | `204` |
| POST | `/api/vehicles/:id/purchase` | Logged in | optional `{ quantity }` (1–100, default 1) | `200 { vehicle, purchase }` |
| POST | `/api/vehicles/:id/restock` | Admin | `{ quantity }` (whole number ≥ 1) | `200 { vehicle }` |
| GET | `/api/vehicles/:id/reviews` | Logged in | — | `200 { reviews, summary }` |
| POST | `/api/vehicles/:id/reviews` | Logged in | `{ rating, comment }` (rating 1–5, comment 1–1000 characters) | `201 { review, summary }` |
| GET | `/api/purchases` | Logged in (own orders) | — | `200 { purchases }`, newest first |
| GET | `/api/purchases/:id` | Logged in (own order) | — | `200 { purchase }` |
| GET | `/api/purchases/:id/invoice` | Logged in (own order) | — | `200` `text/plain` attachment `INV-000001.txt` |
| GET | `/api/admin/analytics` | Admin | query (optional): `from`, `to` (`YYYY-MM-DD`, inclusive) | `200 { range, inventory, sales }` |

Other responses: `400` invalid input, malformed id or malformed JSON; `404` unknown vehicle, or an order that is unknown or belongs to someone else; `409` duplicate email on registration, a second review of the same vehicle, or a purchase of more units than are in stock.

- `user` is `{ id, email, role }`.
- `vehicle` is `{ id, make, model, category, price, quantity, averageRating, reviewCount, createdAt }`, where `averageRating` is `null` when there are no reviews.
- `purchase` is `{ id, invoiceNumber, vehicleId, make, model, category, quantity, unitPrice, totalAmount, purchasedAt }`.
- `review` is `{ id, rating, comment, author, isOwn, createdAt }`, where `author` is the masked email.

## Screenshots

All screenshots were captured from the running application by headless Google Chrome; none are mockups.



## My AI Usage

### Tools used

- **Claude Code** (Anthropic's command-line coding assistant, running the Claude Opus 5.5 model).

### How I used it

I used Claude Code as a pair programmer throughout the project, directing each step and reviewing its output before anything was committed:

- **Planning:** it read the kata PDF, inspected the initial repository, reported configuration problems (missing `.gitignore`, module settings, tsconfig issues) and proposed a sequence of small TDD cycles. Where the PDF was silent — the password minimum, the email format, how admins are created, whether adding/updating vehicles is admin-only — it asked me and I made the decision.
- **Tests first:** it wrote the failing tests for each feature, ran them, and showed me the actual RED output before writing any implementation. I asked it to strengthen tests that passed for the wrong reason (for example, assertions that a 404 page would have satisfied).
- **Implementation:** it wrote the minimum code to make the tests pass, then I reviewed the diff and test results before approving each commit. When one GREEN step went beyond what its tests covered, I had it trimmed back so the extra behaviour came through its own RED/GREEN cycle.
- **Feature extension:** for reviews and ratings, purchase history, invoices, advanced filtering and sorting, admin analytics and the comparison improvements, it followed the same cycle, with a separate RED commit (failing tests) and GREEN commit (implementation) for each backend and frontend step. The history from `afd12ad` to `c409495` shows these pairs.
- **Verification:** it checked behaviour that tests do not cover by calling the running API, ran temporary mutation checks to prove a test could fail (restoring the code afterwards), and verified the vehicle tests' RED state in a temporary git worktree before committing them. It also wrote the end-to-end script in `e2e/` and ran it in headless Chrome against an isolated database.
- **Fixes found by the end-to-end run:** that run found two problems that the unit tests could not catch: the analytics page overflowed on a 390 px phone, and a missing favicon caused a 404 console error. Claude Code fixed both in `046c017`. These fixes have **no RED/GREEN evidence**: no test was seen failing before them in a unit-test run, because jsdom does not compute layout. They are covered only by the end-to-end checks, which failed before the fix (26 of 28 passed) and passed after it.
- **Frontend and setup:** it generated the server entry point, configuration, admin seed script and the React frontend, and checked them against the running backend.
- **Documentation:** it drafted this README and [TEST_REPORT.md](TEST_REPORT.md) from the actual project files and test output, and captured the screenshots from the running application.

Every commit where AI was used carries the trailer `Co-authored-by: Claude <AI@users.noreply.github.com>`.

### Note on commit-message formatting

The kata asks for two empty lines before the co-author trailer. The first eight commits (`39d0801` to `2bbdb1f`) have only one: Git's default commit-message cleanup merged the two blank lines, and this was not noticed until after six of those commits had been pushed. Rather than rewrite published history, I left them as they are; the trailer is still recognised by Git and GitHub. Every later commit was made with `git commit --cleanup=verbatim` and has the required two blank lines.

### Reflection

Working on this project helped me understand how TDD can guide development in small, verifiable steps. I used AI assistance to explore implementation options, write and review tests, debug issues, and document the application. I also reviewed the generated changes and test results rather than relying solely on AI-generated claims. The process reinforced the importance of checking that tests fail for the expected reason before implementing a fix, and verifying the final application through both automated tests and browser-based checks.

The unedited AI chat log is in [PROMPTS.md](PROMPTS.md). It was exported on 2026-10-25 at 18:25 IST, so it covers the work up to that point and not the later sessions that added the features above.
