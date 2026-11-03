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

On the server, create an environment file outside the repository, for example
`/etc/expensedesk/expensedesk.env`, readable only by the deployment account. It must
define these values; do not commit their values:

```dotenv
APP_TAG=
APP_DOMAIN=
APP_KEY=
FIRST_ADMIN_EMAIL=
FIRST_ADMIN_PASSWORD=
```

`APP_TAG` is the immutable image tag to deploy, `APP_DOMAIN` is the public DNS name,
and `APP_KEY` is a Laravel application key. Generate an application key with
`php -r "echo 'base64:'.base64_encode(random_bytes(32)), PHP_EOL;"`. The first-admin
email and password are supplied on the Greenfield Deploy card. If either is empty,
no account is created.

From a checkout on the server, build and start the production stack with:

```sh
docker compose --env-file /etc/expensedesk/expensedesk.env -f docker-compose.prod.yml build
docker compose --env-file /etc/expensedesk/expensedesk.env -f docker-compose.prod.yml up -d
docker compose --env-file /etc/expensedesk/expensedesk.env -f docker-compose.prod.yml ps
```

The app container compiles the frontend into Laravel's public directory. On every
start it creates the SQLite file when absent, runs `php artisan migrate --force`, and
runs `php artisan expensedesk:first-admin`. That command creates the first
Administrator only when both first-admin variables are set and no account exists.
Production startup never runs the development seeder. Caddy obtains and renews the
HTTPS certificate and proxies the frontend and `/api` through the same origin.

The named `database`, `receipts`, and `backups` volumes retain the SQLite database,
private receipt files, and backups across container replacement and restart. Caddy's
certificate state is retained in `caddy_data` and `caddy_config`.

## Backup and restore

For a local development installation, stop `npm run dev` first so no request can
write the SQLite WAL or the receipt directory while they are copied, then run:

```sh
npm run backup
npm run restore
```

`backup` writes `backend/storage/app/backups/backup-<timestamp>/` with the database
file and every receipt. `restore` copies the newest backup back over the database and
the receipts folder; pass a backup folder name to restore a specific one.

Back up the deployed volumes by stopping the app, running the one-off backup
container against the same persistent volumes, and starting the stack again. Caddy
remains up and returns a temporary upstream error while the app is stopped. Stopping
the only writer makes the copied SQLite database and receipts one consistent backup;
copying only the main database file while SQLite is accepting writes in WAL mode can
omit committed transactions.

```sh
docker compose --env-file /etc/expensedesk/expensedesk.env -f docker-compose.prod.yml stop app
docker compose --env-file /etc/expensedesk/expensedesk.env -f docker-compose.prod.yml run --rm app php artisan expensedesk:backup
docker compose --env-file /etc/expensedesk/expensedesk.env -f docker-compose.prod.yml up -d
docker compose --env-file /etc/expensedesk/expensedesk.env -f docker-compose.prod.yml ps
```

To restore a deployed backup, stop the app so nothing can write to SQLite, run the
one-off restore container against the same persistent volumes, and start the stack
again. Omit `backup-YYYYMMDD-HHMMSS` to restore the newest backup.

```sh
docker compose --env-file /etc/expensedesk/expensedesk.env -f docker-compose.prod.yml stop app
docker compose --env-file /etc/expensedesk/expensedesk.env -f docker-compose.prod.yml run --rm app php artisan expensedesk:restore backup-YYYYMMDD-HHMMSS
docker compose --env-file /etc/expensedesk/expensedesk.env -f docker-compose.prod.yml up -d
docker compose --env-file /etc/expensedesk/expensedesk.env -f docker-compose.prod.yml ps
```

## Tests

- Backend: PHPUnit feature tests in `backend/tests/Feature/` cover every endpoint and
  its 401/403/419/422/409/503 answers, the paise totals, the single reimbursement and
  the audit event written in the same transaction.
- Frontend: Vitest component and unit tests in `frontend/src/**/__tests__/`.
- Browser: Playwright journeys live in `e2e/`.
