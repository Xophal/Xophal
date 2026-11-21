# Mock-test subscriptions

## Payment and access model

Subscriptions use the existing manual UPI account in `manual_payment_settings`; no payment gateway is involved. The server snapshots an active INR plan into a pending `payment_submissions` order and returns its exact amount and unique reference for the QR code. Students can submit a UTR, payment time, note, and private screenshot, but none of these claims grants access. Only the admin payment-verification action, after reconciling the incoming payment in the receiving account and confirming the exact amount, activates access.

Approved orders create one subscription transactionally. Renewals are **queued until the latest active subscription expiry**. Repeated approval is idempotent. Access is derived from the active subscription and checked on the server for test status, availability window, student board/class, plan board/class/subject scope, included test IDs, allowed test categories, and optional per-test attempt limits. Existing free tests remain free. A subscription whose plan is later deactivated retains the already-purchased access, but the plan cannot be selected for new orders.

Expiry is enforced by the access check even if a scheduled job is unavailable. The hosted project has `pg_cron` enabled and `xophal-expire-subscriptions` scheduled every 15 minutes. Migration 062 also creates this job when `pg_cron` is enabled; otherwise configure a trusted scheduler to invoke `expire_subscriptions()` with the service role. Do not expose the service-role key to a browser.

## Deployment

1. Back up the database and confirm migrations `052_secure_ebook_delivery.sql`, `059_rls_every_public_table.sql`, and `062_secure_subscription_test_access.sql` are applied. Version 062 avoids a collision with the hosted project's existing, unrelated migration 053.
2. Confirm the private `subscription-payment-evidence` bucket and its owner/admin policies exist after migration.
3. Configure the receiving UPI ID and payee name in Admin → Subscriptions → Manual UPI payment. Enable payments only after verifying the receiving account.
4. Create plans with the appropriate INR price, duration, board/class/subject scope, included tests/categories, features, and any attempt limit. Confirm mock tests have the intended access category and availability dates before publishing.
5. Ensure `pg_cron` is enabled or configure a trusted scheduled call to `public.expire_subscriptions()`. The protected test-access function checks expiry independently.
6. Smoke-test using an authorized admin and student account. Use a real low-value UPI transfer, verify the incoming transaction in the receiving account, then approve the matching order from the admin queue. Never use a screenshot, student-entered UTR, or synthetic database update as payment verification.

## Operational controls

- Payment verification, status changes, expiry, activation, and refunds are recorded in payment events, subscription history, and admin audit logs.
- A refund remains `pending` until an admin records its actual outgoing refund reference and date. A verified refund can revoke access according to the selected access-revocation option; refunded access is not restored by the generic restore action.
- Admins can suspend, restore an unexpired suspended subscription, or revoke access. Refund approval is restricted to refund approvers, subscription management to subscription admins, and payment approval to payment verifiers or higher roles.
- Student order, subscription, history, and refund reads are owner-scoped by server-side queries and RLS.

## Validation and limits

Automated tests exercise payment approval API behavior, entitlement derivation, and mock-test start denial. They do not prove an incoming UPI payment, apply a production migration, or validate live RLS against a hosted Supabase project. Complete the real-payment smoke test after deployment and record the actual receiving-account reconciliation operationally.
