# SAGI backend

Production-oriented e-commerce API built as a TypeScript/Express modular monolith. It uses PostgreSQL/Prisma, JWT access tokens with rotated, hashed refresh sessions, Stripe Checkout/webhooks, structured Pino logs, audit records, and transaction investigation data.

## Start

1. Copy `.env.example` to `.env` and replace every placeholder secret.
2. Create PostgreSQL database, then run `npm install`, `npm run prisma:generate`, and `npm run prisma:migrate`.
3. Run `npm run dev`; health is at `/health`, docs at `/docs` when `SWAGGER_ENABLED=true`.

Configure Stripe to deliver events to `POST /api/v1/webhooks/stripe`. That route deliberately receives `express.raw()` before JSON middleware so signature verification remains valid.

## Payment lifecycle

An authenticated customer creates an order from a server-priced cart, then calls `POST /api/v1/payments/checkout` with an `Idempotency-Key`. The server creates a Payment/PaymentAttempt and Stripe Checkout session. Only a verified Stripe webhook marks payment successful. In one database transaction it marks payment/order paid, releases reservations, records stock sold transactions, status history, and a transaction log. Duplicate Stripe event IDs are unique and processed idempotently.

Admins use `/api/v1/admin/transactions`, `/transactions/:id/timeline`, and Stripe-event endpoints to trace payment references. The system never stores card details or Stripe credentials in the database.

## Security and operations

Secrets are environment-only. Request IDs and Pino redaction prevent credential logging. Helmet, CORS, request validation, role middleware, rate limits, opaque cookie refresh tokens, audit logging, and Prisma transactions protect core flows. Run migrations in CI/CD and restrict `/docs` to trusted environments. Financial, payment, webhook, inventory, audit, and email records must be retained according to your legal/accounting policy.
