# Car Dealership Inventory System

A full-stack inventory system built for the Incubyte TDD kata. Users register and log in, browse and search the dealership's vehicles, and purchase them; admins also add, edit, delete and restock vehicles.

- **Backend:** Node.js, TypeScript, Express 5, PostgreSQL, JWT authentication, bcrypt password hashing
- **Frontend:** React, TypeScript, Tailwind CSS, Vite
- **Tests:** Vitest and Supertest against a real PostgreSQL test database

## Features

**Authentication**
- Register with an email and a password of at least 8 characters. New accounts are always regular users; a client cannot make itself an admin.
- Log in to receive a JWT (`Authorization: Bearer <token>`), signed with HS256 and carrying the user id and role.
- Wrong passwords and unknown emails get the same `401` response, so the API does not reveal which emails are registered.

**Vehicles** (every vehicle has a unique id, make, model, category, price and quantity in stock)
- List all vehicles, including out-of-stock ones.
- Search by make, model or category (partial, case-insensitive) and by an inclusive price range.
- Purchase a vehicle, reducing its quantity by one. Stock never goes below zero, even with simultaneous purchases.
- Admins only: add, update, delete and restock vehicles.

**Frontend** ("Prestige Motors")
- Sign-in and registration pages with inline validation, a password show/hide toggle and loading states.
- A hero section and an inventory grid of vehicle cards showing an illustration (chosen by category, with a fallback if it fails to load), make, model, category, price in rupees (e.g. ₹15,00,000) and stock.
- Search by make and model, filter by category and price range, sort by price or name, clear filters, and a count of matching vehicles.
- A Purchase button on every vehicle, disabled with an "Out of stock" label at zero; it shows a pending state, ignores repeated clicks and updates the stock from the server's response.
- **Favorites:** a heart on each vehicle saves it to a per-user favorites list (kept in this browser's local storage; only vehicle ids are stored, never tokens or passwords), with an "All vehicles / Favorites" switch.
- **Compare:** select up to three vehicles and compare make, model, category, price and stock side by side.
- **Vehicle details:** a dedicated view (URL `#vehicle/<id>`, so it can be linked and the Back button works) with the image, all fields, stock status and a Purchase button.
- Admins only: Add/Edit vehicle dialogs with validation, a Restock dialog with a quantity input, Delete with a confirmation dialog, and a stock management table. The backend enforces these permissions as well.
- Admins only: **inventory statistics** (vehicle models, units in stock, out-of-stock models and total inventory value), calculated from the live inventory returned by the API.
- Success and error messages for every action; an expired session returns to the sign-in page with an explanation.
- Responsive layout for phone, tablet and desktop.

Errors are returned as JSON: `{ "error": "<message>" }`.

## Project structure

```
backend/    Express API (src/), tests (tests/), env templates
frontend/   React single-page app (src/), Vite config with an /api proxy
```

## Prerequisites

- Node.js and npm (developed with Node.js 26.12 and npm 11.20)
- PostgreSQL (developed with PostgreSQL 17), running locally on port 5432

## Setup

### 1. Create the databases

One database for the app and a separate one for the tests. The test database name must end in `_test`: the test suite refuses to run otherwise, because it drops and truncates its tables.

```bash
createdb car_dealer
createdb car_dealer_test
```

The tables are created automatically: the server and the admin seed script run an idempotent migration (`CREATE TABLE IF NOT EXISTS`) on startup, and the tests do the same.

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

Normal users create their own accounts: on the login screen, choose **"No account? Register"**, enter an email and a password of at least 8 characters, and you are logged in as a regular user. Admins log in with the account created by `npm run seed:admin`.

## Running the tests

```bash
cd backend
npm test                # all backend tests
npm run test:coverage   # tests with a coverage report
npm run typecheck       # TypeScript checks for src/ and tests/
```

Current result: 5 test files, 74 tests, all passing. See [TEST_REPORT.md](TEST_REPORT.md) for the backend report.

Frontend tests (Vitest and React Testing Library, using an in-test fake of the API):

```bash
cd frontend
npm test          # 47 tests: auth, inventory, filters, sorting, purchase, admin flows, favorites, compare, details, statistics, error handling
npm run build     # type-check and production build
```

## API

All `/api/vehicles` routes require `Authorization: Bearer <token>` from the login endpoint. Missing or invalid tokens get `401`; non-admins calling admin routes get `403`.

| Method | Route | Access | Body / query | Success |
|---|---|---|---|---|
| POST | `/api/auth/register` | Public | `{ email, password }` | `201 { user }` |
| POST | `/api/auth/login` | Public | `{ email, password }` | `200 { token, user }` |
| GET | `/api/vehicles` | Logged in | — | `200 { vehicles }` |
| GET | `/api/vehicles/search` | Logged in | query: `make`, `model`, `category`, `minPrice`, `maxPrice` (all optional) | `200 { vehicles }` |
| POST | `/api/vehicles` | Admin | `{ make, model, category, price, quantity }` | `201 { vehicle }` |
| PUT | `/api/vehicles/:id` | Admin | any of `make`, `model`, `category`, `price`, `quantity` | `200 { vehicle }` |
| DELETE | `/api/vehicles/:id` | Admin | — | `204` |
| POST | `/api/vehicles/:id/purchase` | Logged in | — | `200 { vehicle }` (quantity − 1) |
| POST | `/api/vehicles/:id/restock` | Admin | `{ quantity }` (whole number ≥ 1) | `200 { vehicle }` |

Other responses: `400` invalid input or malformed id, `404` unknown vehicle, `409` duplicate email on registration or purchase of an out-of-stock vehicle.

`user` is `{ id, email, role }`; `vehicle` is `{ id, make, model, category, price, quantity }`.

## Screenshots

Captured from the running application (headless Chrome driving the real frontend and backend with the real PostgreSQL data).

**Sign-in page**

![Sign-in page](docs/screenshots/login.png)

**Admin: hero, inventory grid with management controls, and the stock management table**

![Admin inventory](docs/screenshots/admin-inventory.png)

**Admin: out-of-stock vehicle with Purchase disabled**

![Admin view with an out-of-stock vehicle](docs/screenshots/admin-zero-stock-purchase-disabled.png)

**Admin: SUVs sorted by price, high to low**

![Admin search and sort](docs/screenshots/admin-search.png)

**Admin: Add vehicle dialog with inline validation**

![Add vehicle dialog](docs/screenshots/admin-add-vehicle.png)

**Admin: stock management table**

![Stock management](docs/screenshots/admin-manage.png)

**Admin: inventory statistics above the stock table**

![Inventory statistics](docs/screenshots/admin-stats.png)

**Regular user: inventory with only the Purchase action**

![User inventory](docs/screenshots/user-inventory.png)

**Regular user: Purchase disabled for an out-of-stock vehicle**

![User view with an out-of-stock vehicle](docs/screenshots/user-zero-stock-purchase-disabled.png)

**Favorites view**

![Favorites](docs/screenshots/user-favorites.png)

**Comparing three vehicles**

![Compare vehicles](docs/screenshots/compare.png)

**Vehicle details after a purchase** (shown on a temporary test vehicle)

![Vehicle details](docs/screenshots/vehicle-details.png)

**Tablet (820 px) and phone (390 px) layouts**

![Tablet layout](docs/screenshots/tablet-inventory.png)

![Phone layout](docs/screenshots/mobile-inventory.png)

## My AI Usage

### Tools used

- **Claude Code** (Anthropic's command-line coding assistant, running the Claude Opus 5.5 model).

### How I used it

I used Claude Code as a pair programmer throughout the project, directing each step and reviewing its output before anything was committed:

- **Planning:** it read the kata PDF, inspected the initial repository, reported configuration problems (missing `.gitignore`, module settings, tsconfig issues) and proposed a sequence of small TDD cycles. Where the PDF was silent — the password minimum, the email format, how admins are created, whether adding/updating vehicles is admin-only — it asked me and I made the decision.
- **Tests first:** it wrote the failing tests for each feature, ran them, and showed me the actual RED output before writing any implementation. I asked it to strengthen tests that passed for the wrong reason (for example, assertions that a 404 page would have satisfied).
- **Implementation:** it wrote the minimum code to make the tests pass, then I reviewed the diff and test results before approving each commit. When one GREEN step went beyond what its tests covered, I had it trimmed back so the extra behaviour came through its own RED/GREEN cycle.
- **Verification:** it checked behaviour that tests do not cover by calling the running API, ran temporary mutation checks to prove a test could fail (restoring the code afterwards), and verified the vehicle tests' RED state in a temporary git worktree before committing them.
- **Frontend and setup:** it generated the server entry point, configuration, admin seed script and the React frontend, and checked them against the running backend.
- **Documentation:** it drafted this README from the actual project files.

Every commit where AI was used carries the trailer `Co-authored-by: Claude <AI@users.noreply.github.com>`.

### Note on commit-message formatting

The kata asks for two empty lines before the co-author trailer. The first eight commits (`39d0801` to `2bbdb1f`) have only one: Git's default commit-message cleanup merged the two blank lines, and this was not noticed until after six of those commits had been pushed. Rather than rewrite published history, I left them as they are; the trailer is still recognised by Git and GitHub. Every later commit was made with `git commit --cleanup=verbatim` and has the required two blank lines.

### Reflection

Working on this project helped me understand how TDD can guide development in small, verifiable steps. I used AI assistance to explore implementation options, write and review tests, debug issues, and document the application. I also reviewed the generated changes and test results rather than relying solely on AI-generated claims. The process reinforced the importance of checking that tests fail for the expected reason before implementing a fix, and verifying the final application through both automated tests and browser-based checks.

The full, unedited AI chat log is in [PROMPTS.md](PROMPTS.md).
