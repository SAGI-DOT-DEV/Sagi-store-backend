# SAGI transactional emails

All current outgoing email flows use the shared cream, charcoal and gold store template:
- Account email verification (24-hour link).
- Payment confirmation and order status notifications.
- Delivered-order review requests.

`src/core/email/store-template.ts` owns the layout, logo, footer and button. `order-template.ts` owns order copy and item/totals tables. Each email includes a plain-text alternative. Sending providers, event triggers and email-log/idempotency behavior are unchanged.

## Logo and links

Set `APP_URL` to the deployed frontend origin. The default logo is `/Asset%201%20(1).png` on that origin, using the image in the frontend public folder. Deploy that asset with the frontend. Localhost image URLs cannot be loaded by recipients' email clients.

Optionally set `EMAIL_LOGO_URL` to an absolute publicly accessible HTTPS image URL to host the logo separately (also useful when testing locally). This is optional; no new required environment variable was added. Some mail clients block remote images until the recipient allows them; the SAGI alt text remains available.

Run the mocked tests without sending email:

```sh
npx vitest run src/core/email/store-template.test.ts src/core/email/email-delivery.test.ts src/modules/auth/email-verification.test.ts
```

Before rollout, send to an authorized test inbox and check Gmail/Outlook/mobile rendering. Automated tests do not guarantee identical rendering in every email client.
