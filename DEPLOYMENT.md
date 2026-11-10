# Deployment checklist

Follow this runbook for a full-feature production launch. Production credentials belong in the hosting provider's encrypted environment settings, never in Git.

1. Build & runtime
   - Use Node.js 24.x, as required by `package.json`.
   - Set the production start command to `npm start` (or use the hosting platform's Next.js runtime).

2. Environment variables (important)
   - Configure `NEXT_PUBLIC_APP_URL` to the canonical HTTPS production domain.
   - Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from the production Supabase project.
   - Configure `SUPABASE_SERVICE_ROLE_KEY` as a server-only secret; never use a `NEXT_PUBLIC_` prefix for it.
   - Configure both `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. Production auth routes fail closed without rate limiting.
   - Configure `RESEND_API_KEY`, a verified-domain `RESEND_FROM`, and exactly two distinct addresses in `MAIN_ADMIN_EMAILS` for admin approval notifications.
   - Configure `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` for payments and payment fulfillment. Use live credentials for production.
   - Razorpay Route payouts remain disabled by default. Enable `RAZORPAY_ROUTE_ENABLED=true` only after Route is activated on the parent account and the webhook at `/api/ebooks/webhook/razorpay-route` is configured; then set `RAZORPAY_ROUTE_WEBHOOK_SECRET` as a server-only secret.
   - `npm run deploy:check` validates these values, rejects placeholders, local auth bypass, and non-HTTPS URLs. Hosting-provided environment variables take precedence over local files.
   - `.env.example` is a variable-name template only. Do not put real credentials in it or commit `.env.local`.

3. Database & Supabase
   - Create a production Supabase project separate from development and staging.
   - Review and back up the production database before applying migrations.
   - Link the Supabase CLI to the intended project and apply all pending repository migrations with `supabase db push`.
   - Confirm the latest migration is applied, including question/test access, exam integrity, ebook marketplace, and security hardening migration `040`. Migration `047` adds manual UPI subscription checkout settings; migration `048` adds transactional subscription fulfillment support, serialized eBook checkout reservations, and idempotent partial/full refund accounting; migration `049` adds manual UPI eBook/mock-test requests, approval fulfillment, cross-product reference checks, and seller settlement reporting. Migration `040` enforces active-account checks in role/entitlement helpers and restricts attempt RPC access.
   - Verify RLS policies with anon, active-user, and deactivated-user clients; confirm disabled accounts lose admin/reviewer privileges and premium entitlements, and attempt RPCs reject anonymous and non-owner callers.
   - Seed production only with approved, non-test content; do not copy local test users or payment data.

4. Email & OAuth
   - Enable the Email provider in Supabase Auth settings and configure production SMTP. Resend credentials in app env are used for admin-approval notifications; they do not configure Supabase Auth email delivery.
   - Configure the email template to include the OTP token with `{{ .Token }}`.
   - Set an appropriate OTP expiry and confirm email rate limits in Supabase Auth settings.
   - In Supabase Dashboard > Authentication > URL Configuration, set the Site URL to `NEXT_PUBLIC_APP_URL`.
   - Add these exact redirect URLs to the Supabase allowlist:
     - `${NEXT_PUBLIC_APP_URL}/auth/callback`
     - `${NEXT_PUBLIC_APP_URL}/reset-password`
   - Keep these allowlist entries free of query strings. Supabase matches the
     full `redirectTo` URL, so `/auth/callback?next=/dashboard` no longer matches
     `/auth/callback` and Supabase silently falls back to the Site URL (the
     homepage). The Google button therefore stores the destination in the
     `xophol_oauth_next` cookie and sends a bare callback URL.

   - For local testing, use `http://localhost:3000/auth/callback` and `http://localhost:3000/reset-password`.
   - If Google sign-in is enabled, configure its provider credentials and authorized redirect URI in Supabase before setting `NEXT_PUBLIC_ENABLE_GOOGLE_AUTH=true`.
   - Configure the Razorpay webhook endpoint as `${NEXT_PUBLIC_APP_URL}/api/webhooks/razorpay`, subscribe to `payment.captured` and `payment.failed`, and set the matching webhook secret in the hosting platform.
   - For manual UPI checkout, open Admin > Subscriptions, set the verified merchant UPI ID and payee name, then enable manual UPI payments. Students can pay for subscriptions, paid eBooks, and premium mock tests using an amount-specific QR. Staff must reconcile the submitted transaction reference with the payment account and approve it in Admin > UPI verifications before access is granted.
   - eBook seller proceeds from manual UPI sales are recorded as balances awaiting settlement outside the site. Do not enable automatic Route payouts for these transactions. New Razorpay order creation is disabled for subscriptions, eBooks, and mock tests; legacy verification/webhook endpoints remain for transactions already in progress.

5. Secrets & CI
   - Add production variables to the hosting platform's Production environment; configure Preview variables separately and use non-production provider credentials there.
   - In GitHub, create Settings > Environments > `production`; require reviewer approval and restrict deployment branches to `main`.
   - Add these 12 Actions environment secrets to that environment: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `RESEND_API_KEY`, `RESEND_FROM`, `MAIN_ADMIN_EMAILS`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET`.
   - `.github/workflows/ci.yml` runs install, typecheck, tests, and build on pushes and pull requests. From the `main` branch, use Actions > CI > Run workflow to run the production-readiness job against the protected environment secrets.
   - Do not run production secrets in pull-request CI. Never print environment values in build logs or expose the service-role, Razorpay secret, webhook secret, Upstash token, or Resend key to the client.

6. Observability & monitoring
   - Configure error reporting and uptime monitoring for the production domain.
   - Alert on auth 503s, payment webhook failures, database errors, and provider rate limits. Do not log request secrets or OTP values.

7. Post-deploy verification
   - Verify homepage, login/register, forgot/reset email flows end-to-end.
   - Run `npm run deploy:check`, `npm run typecheck`, `npm test`, and `npm run build` against the release configuration.
   - Verify student registration, OTP delivery/verification, login, logout, password reset, and protected-route behavior using non-production test accounts first.
    - Verify admin approval emails go only to the two configured main administrators and that unapproved users cannot access admin routes.
    - Verify each manual UPI purchase path in staging with a small payment: scan a subscription, eBook, and premium mock-test QR; submit each actual UPI reference; confirm access stays pending; then approve in Admin > UPI verifications and verify the corresponding access or eBook seller balance.
    - Confirm new checkout requests cannot create Razorpay orders and that eBook manual-sale balances remain unavailable to automatic Route payouts.
    - Confirm database reads/writes, RLS behavior, admin operations, and content access in production with least-privilege test accounts.
    - Confirm both Upstash credentials are set together; production auth endpoints intentionally fail closed with `503 RATE_LIMIT_NOT_CONFIGURED` otherwise.

8. Optional optimizations
   - Set `NEXT_PUBLIC_APP_URL` canonical and OpenGraph/SEO meta tags for pages.
   - Configure image optimization domains in `next.config.js`.

9. Rollback plan
   - Take a verified database backup before schema/content releases and document restoration steps.
   - Keep the previous application deployment available for rollback; roll back database changes only with a reviewed, tested migration plan.

10. Commands recap
```bash
# run tests and checks
npm ci
npm run typecheck
npm test
npm run deploy:check
npm run build

# apply reviewed migrations to the linked production project
supabase db push
```

Production is not ready until provider setup, migrations, the deployment check, and the end-to-end verification steps all pass. The app can build without live provider values, so a successful build alone is not a production-readiness signal.
