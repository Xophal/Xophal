# Authorization Audit

Date: 2026-07-21

## Scope

Reviewed middleware, all route handlers under `src/app/api`, server actions, admin pages, student/dashboard pages, Supabase authorization policies, and server-side data access.

## Inventory

- API route handlers: six `GET` catalog endpoints.
- Server Actions: none found.
- Implemented admin pages: none found; admin directories are currently empty.
- Implemented protected student page: `/dashboard`, protected by the student layout and `requireAuth()`.
- Middleware: refreshes Supabase sessions, protects non-public pages, verifies email, and checks admin roles for `/admin/*`.

## Vulnerable operations found and remediated

| Surface | Vulnerability | Remediation |
| --- | --- | --- |
| Supabase `profiles` insert/update | A client could potentially set `role_id`, premium state, account state, or server-calculated progression fields. | Added a protected-field trigger, explicit update `WITH CHECK`, revoked client profile inserts, and made premium entitlement subscription-derived. |
| `/api/mock-tests` | Unauthenticated/free users could receive premium test metadata. | The handler now checks the verified user and active subscription, and filters premium tests for users without entitlement. RLS now enforces the same rule. |
| `mock_test_sections` / `mock_test_questions` | Supporting test structure was not protected by RLS. | Added RLS and premium/admin read policies. |
| `test_attempts` | Owners could directly mutate scores, status, ranking, and submission fields. | Revoked client insert/update/delete access; trusted server workflows must create and score attempts. |
| `test_responses` | Owners could directly mutate correctness and awarded marks. | Revoked client insert/update/delete access; trusted server workflows must score responses. |
| `payments` | Authenticated clients could insert forged amount, status, and Razorpay fields. | Revoked client insert/update/delete access. Payment creation and confirmation must be server/webhook controlled. |
| `subscriptions`, achievements, certificates, leaderboard, audit logs | Sensitive server-controlled records lacked sufficiently restrictive direct-write controls. | Enabled RLS where missing and revoked client mutations. |
| Roles and permissions | Authorization reference tables were not protected by RLS. | Added admin-only policies. |
| Question answer/variant tables | Question answer material was not protected by RLS. | Added admin-only policies. |
| `/api/classes`, `/api/subjects`, `/api/chapters`, `/api/topics` | Active child records could be queried through inactive parents. | Added active-parent validation before serving results. |
| Middleware role policy | Middleware allowed `moderator` while database admin checks did not. | Aligned middleware and `ADMIN_ROLES` with the database policy: `super_admin`, `admin`, and `content_manager`. |

## Protected operations with no current vulnerability

- `/api/boards`: intentionally public active-board catalog.
- `/api/classes`: public, now validates an active board.
- `/api/subjects`: public, now validates active class and board.
- `/api/chapters`: public, now validates active subject, class, and board.
- `/api/topics`: public, now validates active chapter, subject, class, and board.
- `/dashboard`: server-side authentication and current-user ownership filters are present.
- Admin pages and server actions: no implemented routable pages/actions were found to audit.

## Remaining deployment requirements

1. Apply `supabase/migrations/005_authorization_hardening.sql` to every environment.
2. Payment order creation, Razorpay signature verification, subscription updates, test creation, scoring, and certificate issuance must use trusted server-side workflows; no such workflows currently exist in this repository.
3. Test all Supabase Data API tables as anonymous, student, premium student, and admin users after migration.
4. Add integration tests for profile privilege escalation, premium test access, test integrity, payment writes, and cross-user reads.
5. Treat middleware as routing protection only; every future sensitive API route or server action must independently authenticate and authorize the caller.
