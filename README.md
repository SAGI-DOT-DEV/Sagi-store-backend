# SAGI backend

SAGI is a TypeScript/Express e-commerce API. It is a modular monolith: one deployable service, separated into focused modules for authentication, products, orders, payments, inventory, administration, and backups.

## What it provides

- JWT access tokens plus rotating, hashed refresh-token sessions
- Customer accounts, carts, wishlists, addresses, products, variants, and inventory
- Authenticated cart read/add/update/remove endpoints with stock validation
- Server-priced order creation; inventory is reserved only for an active Stripe Checkout session
- Stripe Checkout and verified Stripe webhook processing
- Customer purchase history at `GET /api/v1/orders/purchase-history`
- Admin payment investigation timelines and Stripe-event inspection
- Business audit records, inventory ledgers, and order-status history
- Optional encrypted PostgreSQL backups uploaded to Google Drive

## Technology

| Area | Choice |
| --- | --- |
| API | Express 5 + TypeScript |
| Database | PostgreSQL + Prisma |
| Authentication | JWT + bcrypt + HTTP-only refresh cookie |
| Payments | Stripe Checkout + webhooks |
| Logs | Pino structured logs |
| Backup storage | Google Drive service account |

## Project layout

```text
src/
  app.ts                 HTTP middleware and route registration
  server.ts              process startup and shutdown
  config/                validated environment configuration
  core/                  authentication, errors, logging, validation
  database/              Prisma client
  modules/               feature modules
    auth/ products/ orders/ payments/ inventory/ admin/ backups/
  webhooks/stripe/       verified Stripe event handling
prisma/schema.prisma     PostgreSQL data model
TESTING.md               local setup and feature-testing walkthrough
```

## Prerequisites

- Node.js 20 or newer
- PostgreSQL 15 or newer
- A Stripe test account for checkout/webhook testing
- PostgreSQL client tools (`pg_dump` and `pg_restore`) only when using backups
- A Google Cloud service account and Drive folder only when using backups

## Local setup

1. Install dependencies:

   ```powershell
   npm install
   ```

2. Copy the environment template and provide real development values:

   ```powershell
   Copy-Item .env.example .env
   ```

3. Create a local PostgreSQL database named `sagi`, then set `DATABASE_URL` in `.env`. For example:

   ```text
   DATABASE_URL=postgresql://postgres:your-password@localhost:5432/sagi?schema=public
   ```

4. Create the schema and generate Prisma’s client:

   ```powershell
   npm run prisma:migrate
   npm run prisma:generate
   ```

5. Start the API:

   ```powershell
   npm run dev
   ```

The health endpoint is `GET http://localhost:3000/health`. API documentation is available at `/docs` when `SWAGGER_ENABLED=true`.

## Common commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run the API with file watching |
| `npm run build` | Compile to `dist/` |
| `npm start` | Run the compiled API |
| `npm test` | Run Vitest tests |
| `npm run prisma:migrate` | Create/apply development migrations |
| `npm run prisma:generate` | Regenerate Prisma client |

## Production container deployment

The repository includes a multi-stage, non-root Docker image and a production Compose file. The image does not copy environment files or secrets.

1. Create the production environment file and fill in real production values:

   ```powershell
   Copy-Item .env.example .env.production
   ```

   Set `NODE_ENV=production`, a production `DATABASE_URL`, strong JWT secrets, live Stripe/Shippo/Cloudinary/Gmail settings, and the production CORS/frontend URL. Keep `.env.production` out of git.

2. Apply Prisma migrations from a deployment machine with the project dependencies installed:

   ```powershell
   npm ci
   npx prisma migrate deploy
   ```

3. Build and start the API:

   ```powershell
   docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
   docker compose --env-file .env.production -f docker-compose.prod.yml logs -f api
   ```

   Verify `http://localhost:3000/health` (or the configured `HOST_PORT`). Put the container behind an HTTPS reverse proxy/load balancer for a public deployment.

To stop it, run `docker compose --env-file .env.production -f docker-compose.prod.yml down`.
| `npx prisma studio` | Browse/edit local database records during development |

## Important API routes

All `/api/v1` routes return `{ success, data }` on success. Protected routes require `Authorization: Bearer <access-token>`.

| Route | Access | Purpose |
| --- | --- | --- |
| `POST /api/v1/auth/register` | Public | Start a signup and send a confirmation email; no account exists yet |
| `POST /api/v1/auth/verify-email` | Public | Confirm a user email and create the account, cart, wishlist, and session |
| `POST /api/v1/distributors/signup` | Public | Submit a distributor application for manual admin review |
| `GET /api/v1/admin/distributors` | Admin | List distributor applications |
| `POST /api/v1/auth/login` | Public | Sign in and receive access token |
| `GET /api/v1/auth/me` | Signed-in user | Read profile and addresses |
| `GET /api/v1/products` | Public | List active products |
| `POST /api/v1/products` | Admin | Create product |
| `GET /api/v1/cart` | Signed-in user | Read current cart, items, variants, and availability data |
| `POST /api/v1/cart/items` | Signed-in user | Add quantity to a variant in the cart |
| `PATCH /api/v1/cart/items/:variantId` | Signed-in user | Set an item’s quantity |
| `DELETE /api/v1/cart/items/:variantId` | Signed-in user | Remove an item from the cart |
| `POST /api/v1/orders` | Signed-in user | Create order from cart |
| `GET /api/v1/orders/purchase-history` | Signed-in user | User’s orders, items, payments, and status timeline |
| `POST /api/v1/payments/checkout` | Signed-in user | Start Stripe Checkout; needs `Idempotency-Key` |
| `POST /api/v1/webhooks/stripe` | Stripe only | Verify/process Stripe events |
| `GET /api/v1/admin/transactions` | Admin | Search payments |
| `GET, POST /api/v1/admin/backups` | Admin | List/run encrypted Drive backups |

## Payment and inventory lifecycle

```text
Cart → order creation → Stripe Checkout created → inventory reserved
                                                  ↓
                                       verified Stripe webhook
                                                  ↓
Payment succeeds → order paid → reservation converted to sold inventory

Checkout expires → reservation released → order cancelled
```

The webhook, not a browser redirect, is authoritative. Duplicate Stripe event IDs are stored and handled idempotently.

## Audit and operational logs

`AuditLog` tracks selected business actions such as user registration/login, product creation, order creation, admin order-status changes, and backup outcomes. `TransactionLog`, `OrderStatusHistory`, `InventoryTransaction`, and `StripeEvent` serve more specific investigation purposes. Pino application logs include a request ID and redact token/password fields.

## Encrypted Google Drive backups

Backups are disabled by default. When enabled, the service generates a PostgreSQL custom dump, encrypts it with AES-256-GCM, uploads only the encrypted file to a dedicated Google Drive folder, and records the checksum, encryption metadata, Drive ID, and outcome in the database.

Set these variables in `.env`:

```text
BACKUP_ENABLED=true
BACKUP_CRON=0 2 * * *
BACKUP_TIMEZONE=Africa/Lagos
GOOGLE_DRIVE_FOLDER_ID=your-folder-id
GOOGLE_SERVICE_ACCOUNT_JSON_BASE64=base64-encoded-service-account-json
BACKUP_ENCRYPTION_KEY_BASE64=base64-of-exactly-32-random-bytes
```

Share the Drive folder with the service account’s email address. Use a dedicated folder and account; never commit the service-account JSON or encryption key. A manual backup is admin-only: `POST /api/v1/admin/backups`.

There is intentionally no API restore endpoint. A restore can overwrite a database, so it must be performed by an authorized operator into an empty staging database first. Preserve the corresponding `Backup` record because it contains the IV and authentication tag needed to decrypt the downloaded file before using `pg_restore`.

## Before production

- Use strong, unique secrets and production Stripe credentials.
- Run Prisma migrations in CI/CD, not interactively on a production server.
- Set precise CORS origins, HTTPS, `NODE_ENV=production`, and a trusted reverse proxy.
- Store Google credentials and encryption keys in a secret manager.
- Test backup restoration regularly in a separate database.
- Define retention/deletion policies for customer, payment, audit, and backup data.

See [TESTING.md](TESTING.md) for a full first-run testing guide.
