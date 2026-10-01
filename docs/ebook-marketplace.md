# eBook Marketplace Rollout

The marketplace is a secondary discovery and contributor feature. Mock tests remain the primary Xophol product.

## Database and storage

Apply `supabase/migrations/026_ebook_marketplace.sql`, `027_ebook_marketplace_commerce.sql`, `028_ebook_fulfillment_url_privacy.sql`, and `029_ebook_razorpay_route.sql` after the existing migrations. Together they create marketplace categories, contributor profiles, listings, reports, admin settings, analytics events, and a transaction ledger, then add listing lifecycle timestamps, revision-safe settings, payout columns, a column-level public listing grant that withholds seller fulfillment URLs, and Razorpay Route linked-account/payout support. These migrations are idempotent and do not modify mock-test, authentication, or existing payment tables.

The existing `public` Supabase Storage bucket is used only for normalized cover images (`ebook-covers/`). Cover uploads are authenticated, size-limited, signature-checked, and optimized by the server. Original eBook files remain on the seller's external product destination and are never uploaded to Xophol.

Row-level security keeps discovery public while writes stay server-side: `ebook_listings` is readable by anyone only when `status = 'PUBLISHED'`, `ebook_contributors` is public only while the contributor has a published listing, and sellers can additionally read their own rows. All mutations go through API routes that use the service client after server-side auth, role, and ownership checks.

## Payments and commission

Listings are free and always enter admin review (`PENDING_REVIEW`) before they become `PUBLISHED`. Commission is read from the `ebook_marketplace_settings` table (admin-editable at `/admin/ebooks` → "Commission & rules") and snapshotted onto every order row, so historical revenue never changes when the rate is updated.

An order starts as `PENDING` from `/api/ebooks/checkout` (Razorpay order created server-side) and only becomes `VERIFIED` after the signed Razorpay webhook (`/api/ebooks/webhook/razorpay`) or `/api/ebooks/purchase/verify` confirms a captured payment with the expected order, amount, and currency. The browser can never mark an order paid, and the signed webhook requires `RAZORPAY_WEBHOOK_SECRET`. Commission and configured fee/tax estimates are snapshotted per order; estimated deductions are not a final seller net payout.

Access to the paid destination is granted only from a `VERIFIED` row: `/api/ebooks/[ebookId]/external` reveals the seller's external link and records the click through `record_ebook_external_click`. Refunds and payouts follow `PAID` → `PENDING` → (refund window) → `AVAILABLE` → `PAID TO SELLER`; `releaseDueEbookBalances` promotes balances once `payoutHoldDays` has elapsed. Admin revenue totals come from the `get_ebook_admin_revenue` RPC and include `VERIFIED` rows only.

Access to the paid destination is granted only from a `VERIFIED` row: `/api/ebooks/[ebookId]/external` reveals the seller's external link and records the click through `record_ebook_external_click`. Paid checkout fails closed unless Route is enabled and that seller's linked account and settlement destination are verified. Seller payout onboarding and delayed transfers use Razorpay Route. The implementation is gated by `RAZORPAY_ROUTE_ENABLED=true` and `RAZORPAY_ROUTE_WEBHOOK_SECRET`, alongside the existing Razorpay API credentials; the flag defaults to disabled. Configure the webhook at `/api/ebooks/webhook/razorpay-route` with `transfer.processed`, `transfer.failed`, `product.route.activated`, `product.route.under_review`, and `product.route.needs_clarification`. Payouts require actual captured-payment fee and tax values; missing provider settlement data keeps the order ineligible rather than displaying an estimated net as payable. Refund reversals and chargeback recovery after a Route transfer are not yet automated, so keep Route disabled for live paid sales until those flows are implemented and verified in staging. Admin revenue totals come from the `get_ebook_admin_revenue` RPC and include `VERIFIED` rows only.
## Public discovery

Public browsing is fully server-rendered and indexable: the catalogue at `/ebooks` (search, category, language, price, and sort filters), category hubs at `/ebooks/category/[slug]`, listing pages at `/ebooks/[slug]`, and educator profiles at `/authors/[slug]` (with `Person` structured data, expertise chips, and their published listings). Listing pages render `Book` structured data and always link back to free mock tests so the primary funnel is never bypassed.

Only `PUBLISHED` listings are ever rendered. Marketplace URLs are added to `/sitemap.xml` on a best-effort basis alongside the static and board routes, and `/ebooks`, `/ebooks/*`, and `/authors/*` are on the public allowlist in the auth middleware.

Sellers publish and edit their own listings at `/dashboard/ebooks/new` and `/dashboard/ebooks/[id]/edit`. Editing a listing always returns it to `PENDING_REVIEW`, so an approved listing cannot stay public without a fresh moderation pass.

## Administration

Administrators manage the marketplace at `/admin/ebooks` across four tabs: listings (moderation, featuring, suspension), reports raised by readers, categories (create, edit, activate/deactivate, reorder), and settings (commission, price bands, allowed currencies, payment fee, tax, payout hold days, and pricing guidance ranges). Moderation decisions are written with the service client after an admin check, and every state change is recorded in `ebook_events` for analytics.
