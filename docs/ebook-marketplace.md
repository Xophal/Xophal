# eBook Marketplace Rollout

The marketplace is a secondary discovery and contributor feature. Mock tests remain the primary Xophol product.

## Database and storage

Apply migrations `026` through `029`, `034_ebook_moderation.sql`, and `035_ebook_seller_workflow.sql` after the existing migrations. They provide the listing/catalogue schema, column-level public grants, moderation history and status transitions, seller profile fields, draft support, and analytics event names. Migration `035` is additive and preserves existing listings and transaction history. The older commerce and Route schema is retained for compatibility but is not active in this phase.

The existing `public` Supabase Storage bucket is used only for normalized cover images (`ebook-covers/`). Cover uploads are authenticated, size-limited, signature-checked, dimension-checked, and optimized to WebP by the server. Original eBook files remain on the seller's external destination and are never uploaded to Xophol.

Row-level security keeps discovery public while writes stay server-side: `ebook_listings` is readable by anyone only when `status = 'PUBLISHED'`, `ebook_contributors` is public only while the contributor has a published listing, and sellers can additionally read their own rows. All mutations go through API routes that use the service client after server-side auth, role, and ownership checks.

## Payment phase boundary

Listings have no listing fee or subscription requirement. A new listing starts as `DRAFT`; an explicit submission validates required fields and the copyright declaration before moving it to `PENDING_REVIEW`. Sellers cannot edit pending, suspended, or unpublished listings. Rejected and changes-requested listings can be edited and resubmitted.

Payment processing, checkout, seller onboarding, payout requests, and payment webhooks are disabled. Server payment endpoints require `EBOOK_PAYMENTS_ENABLED=true`, whose default is `false`; do not enable it in this phase. Paid public listings show “Purchase option coming soon,” do not expose their external fulfilment URL, and do not create orders. Existing verified purchases, if any, retain their access. Existing Xophol mock-test payment routes are separate and unchanged.

Future payment work can reuse listing, seller, price, currency, and transaction references already present in the compatibility schema. It must be separately reviewed and deliberately enabled; this seller phase creates no new orders or earnings.
## Public discovery

Public browsing is fully server-rendered and indexable: the catalogue at `/ebooks`, category hubs at `/ebooks/category/[slug]`, listing pages at `/ebooks/[slug]`, and educator profiles at `/authors/[slug]` (with `Person` structured data, public profile fields, and published listings). Listing pages render `Book` structured data and link to related free mock tests; mock-test pages link back to published related eBooks.

Only `PUBLISHED` listings are ever rendered. Marketplace URLs are added to `/sitemap.xml` on a best-effort basis alongside the static and board routes, and `/ebooks`, `/ebooks/*`, and `/authors/*` are on the public allowlist in the auth middleware.

Authenticated students and authors use the existing account at `/dashboard/ebooks/new` and `/dashboard/ebooks/[id]/edit`. They can save partial drafts, review a preview, submit or resubmit for moderation, and manage only their own listings. Public contributor fields are seller-controlled; private account data is not included in public queries.

## Administration

Administrators manage the marketplace at `/admin/ebooks`: moderate pending listings, request changes, reject with a reason, suspend, unpublish, restore, feature, manage reports/categories/settings, and review moderation history. Moderation actions are authorized server-side, checked against the database transition trigger, and written to the audit trail.
