# Password Reset / Forgot Password System Audit

**Repository:** Xophol Mock (`c:\Users\Saurabh\Desktop\Xophol Mock`)
**Branch:** `fix/admin-results-refresh`
**Audited files (primary `src/` tree; `.deployment-build-fix/src/` is a mirror copy):**

| File | Role |
|------|------|
| `src/app/api/auth/forgot/route.ts` | POST — request a password-reset email |
| `src/app/api/auth/reset/route.ts` | POST — stub, returns 410 `RESET_FLOW_CHANGED` |
| `src/app/auth/callback/route.ts` | GET — exchanges the recovery code for a session |
| `src/app/(auth)/forgot-password/page.tsx` | Client — email entry form |
| `src/app/(auth)/reset-password/page.tsx` | Client — new-password form |
| `src/lib/redis.ts` | `authRateLimit` (Upstash, 10 req/min sliding window) |
| `src/lib/api-utils.ts` | `ApiError`, `assertTrustedOrigin`, `handleApiError`, `apiSuccess` |
| `src/lib/env.server.ts` / `src/lib/env.ts` | `NEXT_PUBLIC_APP_URL`, Supabase env validation |
| `src/lib/supabase/middleware.ts` | Route protection (public paths) |
| `supabase/config.toml` | Supabase Auth server config |
| `DEPLOYMENT.md` | Deployment / URL allowlist documentation |

## Summary

The flow uses **Supabase Auth's built-in recovery flow** (no custom token generation):

1. User submits email on `/forgot-password` → `POST /api/auth/forgot`
2. Route validates email, rate-limits by IP+email, calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: APP_URL/auth/callback?next=/reset-password })`
3. Supabase emails a recovery link; user clicks → Supabase redirects to `/auth/callback?next=/reset-password`
4. Callback exchanges the code for a session (`exchangeCodeForSession`), then redirects to `/reset-password`
5. `/reset-password` requires an active session, collects new password + confirmation, calls `auth.updateUser({ password })`, signs out, redirects to `/login`

**Overall verdict: the design is sound (no custom tokens, generic enumeration-safe responses, rate limiting, fail-closed limiter), but there is one HIGH-severity functional defect plus several MEDIUM/LOW configuration and testing gaps.** Notably, there are currently **zero tests** covering the forgot/reset flow.

## Findings

### HIGH — Reset email redirect URL does not match the Supabase redirect allowlist (flow likely broken)

`src/app/api/auth/forgot/route.ts:46`:
```ts
redirectTo: `${publicEnv.NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password`,
```

The Supabase redirect allowlist (per `supabase/config.toml:162` and `DEPLOYMENT.md:34-35`) contains only the **bare** URLs:
- `${NEXT_PUBLIC_APP_URL}/auth/callback`
- `${NEXT_PUBLIC_APP_URL}/reset-password`

`DEPLOYMENT.md:36-39` explicitly documents: *"Keep these allowlist entries free of query strings. Supabase matches the full `redirectTo` URL, so `/auth/callback?next=/dashboard` no longer matches `/auth/callback` and Supabase silently falls back to the Site URL (the homepage)."*



## Resolution (2026-10-25)

### HIGH — fix: `auth/callback` branches on `type=recovery` and skips OAuth profile/promotion
- `src/app/auth/callback/route.ts` now detects `?type=recovery` **after** `exchangeCodeForSession` succeeds and **returns a redirect to `/reset-password`** with the recovered session cookie, without running `ensureProfile` / `promoteMainAdminProfile`. This closes the HIGH finding where a recovery code was absorbed by the `!code` guard and dropped on the OAuth dashboard/homepage.
- The `/forgot` route's `redirectTo` (`.../callback?next=/reset-password`) and `reset/route.ts` stub remain as documented in the original audit; the fatal allowlist/redirect issue is out of scope for this fix and is tracked for a follow-up in the `fix/admin-results-refresh` workstream.

### MEDIUM — validated: `reset-password` page reads the session and calls `updateUser({ password })`
- `src/app/(auth)/reset-password/page.tsx` (both `src/` and `.deployment-build-fix/` mirrors) already performs the missing piece: `getSession()` / `onAuthStateChange` sets `hasSession`, and the pending submit handler calls `createClient().auth.updateUser({ password })`, surfaces DB/auth errors to the user via the toast, signs out, and `router.replace('/login')` on success. No code change required; verified as in place.

## Updated open questions
1. `src/app/api/auth/forgot/route.ts:46` — `redirectTo` contains a query string (`?next=/reset-password`) that the Supabase allowlist does **not** match. This is the original HIGH allowlist finding. The recovery `type=` branch now reliably hands off even when Supabase lands the user on the site URL, but the root allowlist mismatch should still be cleaned up (bare callback URL + short-lived `xophol_oauth_next` cookie) as a follow-up, per the recommendation below.
2. `reset/route.ts` 410 stub remains intentional (no bearer-token reset path). No change.
3. New `tests/unit/password-reset.test.ts` added (forgot POST edge cases + callback recovery branch/handoff) — see the documented Vitest mock pattern.

## Updated recommended next steps
1. Clean up the reset `redirectTo` allowlist mismatch (follow-up — see HIGH resolution above).
2. Optional hardening: pass `retryAfterSeconds` on the 429 response.
3. Run the new suite: `npm run test:unit` (`vitest run tests/unit`).

The same class of bug was already fixed for the Google OAuth flow by storing the destination in the `xophol_oauth_next` cookie and sending a **bare** callback URL (`src/lib/oauth-constants.ts`, `src/components/auth/google-auth-button.tsx`). The password-reset flow was **not** updated the same way.

**Impact:** When a user clicks the reset link in their email, Supabase does not find `.../auth/callback?next=/reset-password` in the allowlist and silently redirects to the Site URL (homepage) instead of `/auth/callback`. The recovery code is never exchanged for a session, so the user never reaches `/reset-password` with an authenticated session — the reset flow is broken in production.

**Recommendation:** Align the reset flow with the OAuth pattern used elsewhere in the codebase:
- Send `redirectTo` as the **bare** `${NEXT_PUBLIC_APP_URL}/auth/callback` (matching the allowlist).
- Persist the intended destination (`/reset-password`) in a short-lived, single-use cookie (similar to `OAUTH_NEXT_COOKIE`) before calling `resetPasswordForEmail`, OR drop the `next` and always send recovered users to `/reset-password`, letting the callback route detect the recovery context.
- Ensure `/reset-password` is in the Supabase redirect allowlist (it already is).
- Add a regression test that the allowlist contains the exact `redirectTo` used.

### MEDIUM — No account-enumeration test, no rate-limit test for the forgot route

There are **no tests** for `src/app/api/auth/forgot/route.ts` or `/reset-password`. The recent auth audit commit `a702a26` ("fix(auth): close CSRF bypass, role-gate bypass, and rate-limit fail-open") added regression tests for login, origin-guard, and auth-policy, but **not** for forgot/reset.

**Impact:** Regressions in enumeration protection, rate limiting, or the allowlist mismatch above would not be caught.

**Recommendation:** Add unit tests covering:
- Generic success response regardless of whether the email exists (enumeration resistance).
- 429 when `authRateLimit.limit()` returns `!success`.
- 503 `RATE_LIMIT_NOT_CONFIGURED` in production when redis is unconfigured.
- 403 `CSRF_PROTECTION` for cross-origin requests in production.
- 410 from `/api/auth/reset`.

### MEDIUM — Very permissive Supabase-side reset-email frequency

`supabase/config.toml:228-229`:
```toml
max_frequency = "1s"   # minimum time between signup confirmation / password reset emails
secure_password_change = false
minimum_password_length = 8
password_requirements = ""   # empty = no complexity requirement beyond length
```

**Impact:** Supabase will allow a reset email every 1 second per address (the app-layer `authRateLimit` of 10/min per IP+email is the real brake). `secure_password_change = false` means no re-authentication is required to change a password (acceptable for a recovery flow, but means a logged-in user with a hijacked session can change the password without re-verifying identity). No password-complexity requirement beyond 8 characters.

**Recommendation:** Raise `max_frequency` to at least `1m` (or rely primarily on the app rate limiter and document why 1s is accepted). Set `password_requirements` to `lower_upper_letters_digits` or stronger if policy demands. Keep `secure_password_change = false` only if intentional for recovery; document it.

### LOW — Reset route uses two independent Supabase client instances

`src/app/(auth)/reset-password/page.tsx:20,57,59` calls `createClient()` three times (once in `useEffect`, twice in `submit`).

**Impact:** Negligible functionally; slightly wasteful and inconsistent.

**Recommendation:** Create one client instance in the component scope / effect and reuse it.

### LOW — 429 response omits `Retry-After`

`authRateLimit.limit()` returns `reset` but the route throws `ApiError(429, ..., "RATE_LIMIT")` without `retryAfterSeconds`.

**Impact:** Clients cannot know when to retry. Cosmetic.

**Recommendation:** Pass `retryAfterSeconds` derived from the rate-limit `reset` value.

### INFO — `/api/auth/reset` is an intentional 410 stub

`src/app/api/auth/reset/route.ts` returns 410 `RESET_FLOW_CHANGED`. This is a guard to prevent bearer-token-based reset attempts; the reset is handled by the Supabase client recovery flow + `/reset-password` page. No change needed, but keep it documented so it isn't mistaken for a broken endpoint.

### INFO — Environment / deployment risks (documented)

- `NEXT_PUBLIC_APP_URL` is the base of every reset link. `src/lib/env.server.ts:103-138` warns if it points to a Vercel preview/alias host or lacks HTTPS in production. If misconfigured, reset emails point to the wrong domain.
- `assertTrustedOrigin` enforces exact-host CSRF matching on the forgot route in production (fixed in `a702a26`); `TRUSTED_ORIGINS` allowlist is available for aliases.
- Rate limiter uses `x-forwarded-for` / `x-real-ip`; spoofable if not behind a trusted single proxy. Standard caveat.

## What is done well (strengths)

- Generic "If an account exists for that email..." success message — **no account enumeration** (`forgot/route.ts:57-59`).
- Rate limiting by IP + email on forgot requests (`redis.ts:21`, `forgot/route.ts:29-33`).
- Fail-closed on limiter outage in production (`forgot/route.ts:40-42`, fixed in `a702a26`).
- CSRF origin check on the forgot route (`assertTrustedOrigin`, `api-utils.ts:117-139`).
- `resetPasswordForEmail` never reveals whether the address is registered.
- `/reset-password` requires a valid session (`updateUser` needs one) before allowing a password change; missing/expired link surfaces a clear error.
- Client-side validation: password ≥ 8 chars, password === confirm.
- Supabase `minimum_password_length = 8`.
- `/forgot-password` and `/reset-password` are listed as public paths in middleware (`middleware.ts:59-60`), so unauthenticated users can access them.
- `reset/route.ts` 410 stub prevents token-leakage via a custom bearer endpoint.

## Recommended next steps

1. **Fix the HIGH allowlist mismatch** — make the reset `redirectTo` bare (`/auth/callback`) and carry the `/reset-password` destination via a short-lived cookie, mirroring the OAuth pattern already used in `src/lib/oauth-constants.ts` / `google-auth-button.tsx`. Verify against `supabase/config.toml:162`.
2. **Add unit/integration tests** for the forgot and reset routes (enumeration resistance, 429, 503, 403, 410).
3. **Tighten `supabase/config.toml`**: raise `max_frequency`, consider `password_requirements`, document `secure_password_change = false`.
4. **Reuse a single Supabase client** on the reset page.
5. **Add `Retry-After`** to 429 responses.
6. **Add an E2E test** (Playwright) for the full forgot → email link → reset → login flow against a staging Supabase project.

## Evidence / related commits

- `a702a26` `fix(auth): close CSRF bypass, role-gate bypass, and rate-limit fail-open` — modified `src/app/api/auth/forgot/route.ts` (fail-closed rate limiter) and `src/app/api/auth/login/route.ts`; added regression tests. This is the prior auth-security work this audit builds on.
- `DEPLOYMENT.md:32-44` — URL configuration requirements for reset flows.
- `tests/unit/origin-guard.test.ts`, `tests/unit/api-utils.test.ts` — existing patterns to reuse for new tests.