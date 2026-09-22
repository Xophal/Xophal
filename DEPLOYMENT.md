# Deployment checklist

Quick checklist to prepare `Xophal` for staging/production deployment.

1. Build & runtime
   - Ensure Node >= 20.
   - Build command: `npm run build` and start with `npm start` (or use platform runner).

2. Environment variables (important)
   - `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL (public).
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key (public client usage).
   - `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (server only; use Secrets manager).
   - `NEXT_PUBLIC_APP_URL` — Public URL (e.g., https://your-app.vercel.app).
   - `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` — required in production for authentication rate limiting.
   - `RESEND_API_KEY` or SMTP credentials — for sending OTP, password reset, verification, and invite emails.
   - `RAZORPAY_WEBHOOK_SECRET` — secret used to verify Razorpay webhook signatures.
   - `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` — server-side credentials for creating Razorpay orders.
   - Any other secrets referenced in `process.env` (check `src/lib/env.ts`).

3. Database & Supabase
   - Run migrations locally: `npm run db:migrate`.
   - Push migrations to Supabase (link project): `supabase link --project-ref <ref>` then `supabase db push` or use `supabase migrations deploy`. This includes `009_import_jobs.sql`.
   - Generate types if needed: `npm run db:types`.
   - Verify RLS policies and service role permissions for admin operations.

4. Email & OAuth
   - Enable the Email provider in Supabase Auth settings and configure SMTP or Resend.
   - Configure the email template to include the OTP token with `{{ .Token }}`.
   - Set an appropriate OTP expiry and confirm email rate limits in Supabase Auth settings.
   - In Supabase Dashboard > Authentication > URL Configuration, set the Site URL to `NEXT_PUBLIC_APP_URL`.
   - Add these exact redirect URLs to the Supabase allowlist:
     - `${NEXT_PUBLIC_APP_URL}/auth/callback`
     - `${NEXT_PUBLIC_APP_URL}/reset-password`
   - For local testing, use `http://localhost:3000/auth/callback` and `http://localhost:3000/reset-password`.
   - For production, replace `NEXT_PUBLIC_APP_URL` with the canonical HTTPS deployment URL and add the same URLs in the deployment platform environment.
   - Test student OTP signup, existing-user OTP login, invalid/expired codes, password fallback, and admin OTP role enforcement.
   - Configure Razorpay webhook URL and the same `RAZORPAY_WEBHOOK_SECRET` in the deployment platform.

5. Secrets & CI
   - Add all secrets to your deployment platform (Vercel, Netlify, Fly, etc.) via environment variables — do NOT expose `SERVICE_ROLE_KEY` to the browser.
   - Add CI job to run `npm ci`, `npm run typecheck`, `npm test`, and `npm run build` before deploying.

6. Observability & monitoring
   - Add Sentry/Log provider if required.
   - Enable health checks (e.g., /api/health) and uptime monitors.

7. Post-deploy verification
   - Verify homepage, login/register, forgot/reset email flows end-to-end.
   - If OTP returns `OTP_PROVIDER_UNAVAILABLE`, verify DNS/network access to `NEXT_PUBLIC_SUPABASE_URL`, then check Supabase Auth email provider and SMTP/Resend configuration.
   - Verify database reads/writes with seeded test data.
   - Confirm admin operations (content import, user resets) work using service role key.

8. Optional optimizations
   - Set `NEXT_PUBLIC_APP_URL` canonical and OpenGraph/SEO meta tags for pages.
   - Configure image optimization domains in `next.config.js`.

9. Rollback plan
   - Keep backups of critical DB tables and a way to revert the migration if necessary.

10. Commands recap
```bash
# run tests and checks
npm ci
npm run typecheck
npm test

# run migrations locally
npm run db:migrate

# build
npm run build
```

Follow this checklist before marking a deployment as production-ready.
