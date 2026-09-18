# HTTPS email delivery on Render

Set these on Render, then redeploy:

```dotenv
EMAIL_PROVIDER=resend
RESEND_API_KEY=your_private_resend_key
EMAIL_FROM=SAGI <notifications@your-verified-domain>
EMAIL_TIMEOUT_MS=10000
```

Create a Resend account, add your sending domain, publish the DNS records Resend provides, and wait for verification. Create an API key with sending access. Never commit it or place it in frontend variables. The provider accepts messages over HTTPS rather than Render free's blocked SMTP ports. A verified sending domain is required for arbitrary customer recipients; Resend's onboarding sender is for restricted testing, not production. No provider account or DNS changes have been made by this implementation.

All current verification/review/order templates use the shared delivery service. Successful provider acceptance records the provider ID in EmailLog; SENT means accepted for sending, not confirmed inbox delivery. Inspect Resend for delivery/bounce outcomes. HTTP rejection, timeout and missing configuration are recorded as failures. No automatic SMTP fallback or resend occurs, because network timeouts can have uncertain outcomes.

Registration still requires verification. If delivery fails, the frontend keeps the form and offers a retry using the existing rate-limited registration endpoint. Resubmission refreshes the pending registration and token; use only the newest verification link. It does not activate an account or duplicate an existing user. No dedicated public resend endpoint was added. Existing pending registrations can retry by submitting registration again. Order-email automatic durable retry remains a separate improvement.

Deploy the frontend too: /verify-email now renders the confirmation page and registration distinguishes delivery failure from success. Set APP_URL to the current frontend origin. Verify on a test recipient, confirm the link, sign in, then test paid/delivered emails without making live payments.

Local Gmail remains supported with EMAIL_PROVIDER=gmail, EMAIL_FROM, GMAIL_USER and GMAIL_APP_PASSWORD; it has a bounded timeout. The provider defaults to gmail for backwards compatibility, so explicitly set EMAIL_PROVIDER=resend on Render.

No database migration is required. Existing email HTML/text is retained.
