# Testing SAGI locally

This guide starts from no database connection and walks through the features that can be tested today. Use Stripe test-mode keys only.

## 1. Create and connect PostgreSQL

Create an empty local database named `sagi` using pgAdmin, `createdb sagi`, or your preferred PostgreSQL tool. Then create `.env` from the template:

```powershell
Copy-Item .env.example .env
```

Set `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET` in `.env`. JWT secrets must each be at least 32 characters.

Create the schema and start the API:

```powershell
npm install
npm run prisma:migrate
npm run prisma:generate
npm run dev
```

Confirm the server is ready:

```powershell
Invoke-RestMethod http://localhost:3000/health
```

Expected result: `success` is `true` and status is `ok`.

## 2. Register and log in

In another PowerShell window, register a customer:

```powershell
$customer = Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/v1/auth/register -ContentType 'application/json' -Body '{"email":"customer@example.com","password":"Passw0rd!123","firstName":"Test","lastName":"Customer"}'
```

This returns `202 Accepted` and does not create an account yet. It stores a pending registration and sends a confirmation email. `verificationEmailSent` is `true` only when Gmail accepted the message. Configure `GMAIL_USER`, `GMAIL_APP_PASSWORD`, and `EMAIL_FROM` before testing email delivery. `EMAIL_FROM` must be the Gmail account or a verified Gmail "Send mail as" alias.

Confirm the email with its token. This creates `User`, `Profile`, `Cart`, `Wishlist`, `Session`, and the registration audit records; it also returns an access token:

```powershell
$verifiedCustomer = Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/v1/auth/verify-email -ContentType 'application/json' -Body '{"token":"token-from-the-email"}'
$customerToken = $verifiedCustomer.data.accessToken
```

```powershell
Invoke-RestMethod http://localhost:3000/api/v1/auth/me -Headers @{ Authorization = "Bearer $customerToken" }
```

## 2a. Submit a distributor application

```powershell
$distributor = Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/v1/distributors/signup -ContentType 'application/json' -Body '{"firstName":"Dami","lastName":"Ade","phone":"+2348012345678","email":"distributor@example.com"}'
```

The endpoint requires all four fields and stores an application for manual follow-up. No distributor verification email or login is created. An admin can review applications with:

```powershell
Invoke-RestMethod http://localhost:3000/api/v1/admin/distributors -Headers @{ Authorization = "Bearer $adminToken" }
```

## 3. Create an admin and a test product

Register a second account with a different email, then promote it locally. This is intentionally a database operation because there is no public role-management endpoint.

```powershell
npx prisma studio
```

Open the `User` table, change the second user’s `role` to `ADMIN`, save, then log in again and retain its access token as `$adminToken`.

Create an active product with a variant and stock:

```powershell
$product = Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/v1/products -ContentType 'application/json' -Headers @{ Authorization = "Bearer $adminToken" } -Body '{"name":"Test T-Shirt","slug":"test-t-shirt","description":"Local test product","status":"ACTIVE","variants":[{"sku":"TEST-SHIRT-S","name":"Small","price":19.99,"inventory":{"quantity":10}}]}'
$productDetails = Invoke-RestMethod "http://localhost:3000/api/v1/products/$($product.data.id)"
$variantId = $productDetails.data.variants[0].id
```

The returned product will have a `PRODUCT_CREATED` audit record.

## 4. Add the product to the test cart

Add one item using the authenticated cart endpoint:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/v1/cart/items -ContentType 'application/json' -Headers @{ Authorization = "Bearer $customerToken" } -Body "{`"variantId`":`"$variantId`",`"quantity`":1}"
```

Read the cart or change its quantity:

```powershell
Invoke-RestMethod http://localhost:3000/api/v1/cart -Headers @{ Authorization = "Bearer $customerToken" }
Invoke-RestMethod -Method Patch -Uri "http://localhost:3000/api/v1/cart/items/$variantId" -ContentType 'application/json' -Headers @{ Authorization = "Bearer $customerToken" } -Body '{"quantity":2}'
```

The API rejects missing variants, inactive products, invalid quantities, and quantities greater than unreserved inventory. `POST /cart/items` adds to an existing cart quantity; `PATCH` sets an exact quantity.

## 5. Create an order and check purchase history

Create an order:

```powershell
$order = Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/v1/orders -Headers @{ Authorization = "Bearer $customerToken" }
$orderId = $order.data.id
```

Then read the customer’s history:

```powershell
Invoke-RestMethod http://localhost:3000/api/v1/orders/purchase-history -Headers @{ Authorization = "Bearer $customerToken" }
```

You should see a `PENDING_PAYMENT` order, its item, empty payment list, and initial status history. Inventory is not reserved until a Stripe Checkout Session is successfully created, so abandoned orders cannot lock stock indefinitely.

## 6. Test Stripe Checkout and webhook processing

Install the Stripe CLI and authenticate it, then listen for events:

```powershell
stripe login
stripe listen --forward-to http://localhost:3000/api/v1/webhooks/stripe
```

Copy the displayed `whsec_...` value to `STRIPE_WEBHOOK_SECRET` in `.env`, then restart `npm run dev`.

Create Checkout with the same idempotency key if you retry:

```powershell
$checkout = Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/v1/payments/checkout -ContentType 'application/json' -Headers @{ Authorization = "Bearer $customerToken"; 'Idempotency-Key' = 'local-test-order-001' } -Body "{`"orderId`":`"$orderId`"}"
$checkout.data.url
```

Open that URL and complete the Checkout page with Stripe’s test card `4242 4242 4242 4242`, any future date, and any CVC. The Stripe CLI forwards the real event, and the API then marks the payment/order successful, moves stock from reserved to sold, writes order history, and writes a transaction log.

Run purchase history again to confirm status `PAID`. If it remains pending, inspect the server output and `GET /api/v1/admin/transactions` as an admin.

Do not rely on `stripe trigger checkout.session.completed` for this test: it creates a separate Stripe session that is not linked to this API’s payment record.

## 7. Test audit and transaction records

Use Prisma Studio to inspect these tables:

| Table | What to expect |
| --- | --- |
| `AuditLog` | register, login, product/order, and backup events |
| `OrderStatusHistory` | `PENDING_PAYMENT`, then `PAID` after webhook |
| `InventoryTransaction` | reservation (when Checkout starts) and sale records |
| `TransactionLog` | checkout-created and payment-succeeded entries |
| `StripeEvent` | received Stripe payload and processing status |

## 8. Test encrypted Google Drive backups

Do this only after the normal local flow works.

1. Install PostgreSQL client tools and confirm `pg_dump --version` works in a new terminal.
2. In Google Cloud, create a service account, enable Google Drive API, and download its JSON key.
3. Create a dedicated Drive folder and share it with the service account email as Editor.
4. Base64-encode the JSON key in PowerShell:

   ```powershell
   $json = Get-Content .\service-account.json -Raw
   [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($json))
   ```

5. Generate the encryption key:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
   ```

6. Add the generated values to `.env`, set `BACKUP_ENABLED=true`, then restart the API.
7. Request a manual backup as an admin:

   ```powershell
   Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/v1/admin/backups -Headers @{ Authorization = "Bearer $adminToken" }
   Invoke-RestMethod http://localhost:3000/api/v1/admin/backups -Headers @{ Authorization = "Bearer $adminToken" }
   ```

Confirm a `.dump.enc` file appears in the shared Google Drive folder and the backup record is `SUCCEEDED`. The file must not be readable as plain SQL: that is expected. Keep the source database and the matching `Backup` metadata record until you have completed a separately rehearsed restore process.

## Troubleshooting

- **Prisma cannot connect:** check PostgreSQL is running and `DATABASE_URL` is correct.
- **`pg_dump could not be started`:** install PostgreSQL client tools and restart the terminal/API.
- **Stripe event not processed:** ensure `stripe listen` is running, use its current webhook secret, and restart the API after editing `.env`.
- **403 from admin route:** promote the user to `ADMIN`, then log in again to receive a JWT containing the new role.
- **Google upload fails:** verify Drive API is enabled, the folder is shared with the service account, and all three backup secrets are set correctly.
