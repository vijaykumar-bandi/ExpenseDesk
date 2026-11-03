# ExpenseDesk

ExpenseDesk is one internal web app for one Indian company: Employees submit expense
reports with receipts, Managers approve, request changes or reject them, Finance staff
record reimbursements, and Administrators manage users, manager assignments and
categories. Every change is audited.

The repository holds two packages:

- `frontend/` — Vue 3 with TypeScript, Vite, Vue Router and Pinia. A single-page app
  that talks to the API only through `/api`.
- `backend/` — PHP 8.3 with Laravel 12, a REST API under `/api`, SQLite as the
  database (one file on the server), receipts on disk outside the public web directory.

## Requirements

- Node.js 20 or newer
- PHP 8.3 with the `pdo_sqlite`, `mbstring`, `openssl` and `fileinfo` extensions
- Composer

## Build and run

```sh
npm install
npm run dev
```

`npm install` installs the frontend packages and runs `composer install` in `backend/`
through the root `postinstall` script.

`npm run dev` creates `backend/.env` from `backend/.env.example` when it does not exist,
generates the application key, creates the SQLite file, runs the migrations, runs the
idempotent `DevelopmentSeeder` (so the test logins exist in an empty database and a
seeded database is left as it is), then starts:

- the Laravel API on `API_PORT` (default `8000`), and
- Vite on `PORT` (default `5173`), proxying `/api` to the API.

Both listen on `127.0.0.1`. Open `http://127.0.0.1:5173`. The health path is
`/api/health`.

### Test logins

| Role | Email | Password |
| --- | --- | --- |
| Administrator | admin@expensedesk.test | AdminPassw0rd!2026 |
| Finance | finance@expensedesk.test | FinancePassw0rd!2026 |
| Manager | manager@expensedesk.test | ManagerPassw0rd!2026 |
| Employee | employee@expensedesk.test | EmployeePassw0rd!2026 |

The seeder never runs when `APP_ENV=production`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Migrate, seed and start the API and the Vite dev server |
| `npm test` | Run the backend PHPUnit suite, then the frontend Vitest suite |
| `npm run test:backend` | `php artisan test` in `backend/` |
| `npm run test:frontend` | `vitest run` in `frontend/` |
| `npm run build` | Type-check and build the frontend |
| `npm run seed` | Run the `DevelopmentSeeder` |
| `npm run backup` | Copy the SQLite database and the receipts folder into `backend/storage/app/backups/` |
| `npm run restore` | Restore the newest backup (or the one named) |

## Deployment

The production deploy target is a single application server reached over SSH, running
the app in Docker with a Caddy service for HTTPS. One origin serves the compiled
frontend from `backend/public/` and the API under `/api`.

1. Build the frontend with `npm run build` and copy `frontend/dist/` into
   `backend/public/`.
2. Set `APP_ENV=production`, `APP_DEBUG=false`, `APP_KEY`, `APP_URL`,
   `DB_DATABASE` (the SQLite file path) and `SESSION_SECURE_COOKIE=true` in the
   environment.
3. Run `php artisan migrate --force` and `php artisan expensedesk:first-admin`. The
   command creates the first Administrator from `FIRST_ADMIN_EMAIL` and
   `FIRST_ADMIN_PASSWORD` when both are set and no account exists. The seeder never
   runs in production.
4. Keep the database file and `backend/storage/app/receipts/` on persistent volumes.

## Backup and restore

```sh
npm run backup
npm run restore
```

`backup` writes `backend/storage/app/backups/backup-<timestamp>/` with the database
file and every receipt. `restore` copies the newest backup back over the database and
the receipts folder; pass a backup folder name to restore a specific one.

## Tests

- Backend: PHPUnit feature tests in `backend/tests/Feature/` cover every endpoint and
  its 401/403/419/422/409/503 answers, the paise totals, the single reimbursement and
  the audit event written in the same transaction.
- Frontend: Vitest component and unit tests in `frontend/src/**/__tests__/`.
- Browser: Playwright journeys live in `e2e/`.
