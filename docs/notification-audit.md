# Xophol Notification System Audit

**Baseline audit date:** 2026-11-04  
**Read-only refresh:** 2026-11-11  
**Phase:** 1 — read-only initial audit  
**Repository branch:** `fix/admin-results-refresh`  
**Latest commit observed:** `9365ac4` — `Sequence mock test migration after existing migrations`

## Executive summary

Xophol already has a basic in-app notification feature: the `notifications` table, per-user read receipts for global broadcasts, authenticated listing/read APIs, a student bell/list, and an admin broadcast page. A separate `push_subscriptions` table also exists. These are implementation artifacts, not evidence of a complete notification service.

The inspected repository does **not** contain a durable notification event/outbox/queue, worker, retry or dead-letter flow, push sender or service worker, notification delivery email integration, dedicated notification preference/consent model, scheduling/frequency controls, multilingual notification templates, campaign analytics, or a kill switch. No scheduled workflow or notification-specific automated tests were found. The existing admin broadcast directly inserts in-app records; a test-submission API separately inserts a notification after completing the test-submission RPC.

The initial feature status is therefore **PARTIAL**. Production end-to-end behavior cannot be confirmed: unauthenticated requests to notification pages redirect to sign-in and the notification API returns HTTP 401; no authorized test accounts or confirmed isolated staging environment were provided. The actual linked production/staging database schema, grants, RLS behavior, provider configuration, DNS verification, and backup/restore state were not inspected as part of this notification audit. No notification was sent and no database, application, environment, or deployment setting was changed.

**Recommendation:** preserve and incrementally extend the existing notification tables rather than creating duplicate user-facing notification storage. Before migrations, confirm the target Supabase project, recoverable backup, and isolated staging environment. Then design a transactional outbox and bounded database-backed queue, with provider-independent adapters. Do not enable external delivery until consent, eligibility, preferences, rate/frequency controls, and provider verification are implemented and tested.

## Scope, evidence, and limitations

### Inspected

- Package scripts, installed dependency declarations, environment-variable **names only**, service-worker/manifest file inventory, and Git status/branch/latest commit.
- Notification schema and RLS-related repository migrations `001`, `002`, `032`, `033`, and `045`.
- Student notification page, bell, read/delete/list API routes, admin notification page/API, student settings form, test submission API, and existing Resend email helper.
- Notification-related source and migration references, automated-test file inventory, scheduled workflow inventory, and Supabase/Vercel/provider official pricing/scheduling pages.
- Public production notification route behavior using unauthenticated requests.

### Not verified

- Remote database schema, live RLS/grants, migration execution, database triggers/functions not present in the inspected repository files, Realtime publication settings, cron jobs, backups or restore.
- Production environment-variable values, provider account status, email domain/DNS verification, provider webhooks, Vercel project/plan settings, actual deployment identity, staging isolation, and deployment logs.
- Authenticated student/admin behavior, push or email end-to-end delivery, mobile/iOS device behavior, user preference persistence, and parent access.
- No migration, database write, notification delivery, authenticated action, deployment, or test suite was run for this read-only feature audit.

The worktree was already dirty before this audit. In particular, existing changes include package files, `next-env.d.ts`, admin analytics/auth/test files, and untracked `docs/audit.md`, `docs/progress.md`, and tests. During the audit, `src/app/robots.ts` and `src/app/sitemap.ts` also appeared modified in the worktree; they were not present in the initial status and were not inspected or touched. All pre-existing and newly observed changes were left untouched. This audit adds only the two requested notification audit documents.

## Repository architecture and current implementation

- **Application:** Next.js App Router, `next ^16.3.8`, React 19, TypeScript. Supabase SSR/client libraries and PostgreSQL migrations are the primary data access architecture.
- **Existing notification data:** `supabase/migrations/001_initial_schema.sql` defines `notifications(id, user_id, title, message, type, link_url, is_read, is_global, created_at)`.
- **Per-user global-broadcast state:** migration `032_notification_per_user_state.sql` adds `notification_receipts`, with own-user RLS and read/dismiss state.
- **Push data only:** migration `033_notification_delivery_channels.sql` adds `push_subscriptions` with endpoint and encryption-key fields and own-user RLS. No sender, endpoint API, or service worker was found.
- **Read API/database functions:** migration `045_notification_state_hardening.sql` defines paged `get_user_notifications` and `mark_all_user_notifications_read`, with grants restricted to authenticated execution. API handlers use `requireAuth`, trusted-origin checks for mutations, and these RPCs/table operations.
- **Student UI:** `src/components/layout/NotificationBell.tsx` loads five records at component mount; `src/app/(student)/notifications/page.tsx` renders the first 50 from the RPC. `src/components/notifications/NotificationListClient.tsx` supports read, mark-all, and delete/dismiss UI.
- **Admin UI/API:** `src/app/(admin)/admin/notifications/page.tsx` and `src/app/api/admin/notifications/route.ts` provide an immediate global or explicitly selected-user in-app broadcast and paged history. The insert is direct to `notifications`; it is not queued.
- **Test submission:** `src/app/api/mock-tests/submit/route.ts` calls `submit_test_attempt`, then separately tries to insert an in-app “Test submitted” notification. The notification insertion is not part of the attempt RPC transaction; its failure is logged and the submission response can still succeed. It is not evidence that a result was published or that the `result_ready` event exists.
- **Email:** `resend` is a dependency and `RESEND_API_KEY` / `RESEND_FROM` appear among environment-variable names. `src/lib/admin-approval.ts` directly calls the Resend API for admin approval email only. No notification email adapter, unsubscribe system, or notification provider webhook was found.
- **Preferences:** `ProfileSettingsForm` stores a small `settings` JSON object through `/api/profile`; it includes `email_notifications`, `weekly_digest`, and `test_reminders` alongside sound effects. This is not a dedicated, per-category/channel consent and preference service. Quiet hours, timezone, delivery windows, and caps were not found.
- **Tests and scheduling:** repository search found no dedicated notification test files. `.github/workflows` contains `ci.yml`; no scheduled notification workflow, worker, or service worker/manifest file was found.

## Requirement-by-requirement audit

`PRESENT` requires verified behavior, not merely a component/table. `PARTIAL` means some relevant implementation exists but the stated end-to-end requirement or its verification is incomplete. `BLOCKED` means evidence could not be collected because of access or environment constraints. `MISSING` means no implementation was found in the inspected repository.

| Area | Status | Evidence | Risk / gap |
|---|---|---|---|
| In-app notification center | PARTIAL | `notifications` schema; student notification page and `NotificationListClient` | Core list/read actions exist; no verified live authenticated workflow, localized content, expiry, priority, robust error state, or category grouping. |
| Notification database | PARTIAL | `001_initial_schema.sql`; `032_notification_per_user_state.sql`; `045_notification_state_hardening.sql` | Existing table lacks event ID, channel/status, localized body, priority, `read_at`, expiration, and idempotency fields. Avoid creating a parallel `notifications` table. |
| Realtime updates | MISSING | No `supabase.channel`, `postgres_changes`, or equivalent notification subscription found | Bell loads on mount only; new notifications may not appear until navigation/reload. Realtime configuration and quota are also unverified. |
| Unread badge | PARTIAL | `NotificationBell` consumes unread count returned by the list API | Count is fetched once; no real-time/focus refresh. Mutation handlers update the UI without checking HTTP success, so UI can imply a read succeeded when it failed. |
| Pagination | PARTIAL | RPC accepts page/limit and API applies pagination; list page requests 50 records | Main page has no subsequent-page controls; bell requests only five. Database query efficiency/index support was not verified against the live database. |
| Web Push | MISSING | No push sender, registration endpoint, or browser push code found | No delivery, click handling, expiration cleanup, permission UX, or push failure processing. |
| Service worker | MISSING | No `sw.js`, worker, or notification service-worker implementation found | Browser push cannot operate without it. |
| PWA installation | MISSING | No web manifest/service-worker pairing found | iOS Home Screen installation state cannot be recognized or explained. |
| Push subscriptions | PARTIAL | `033_notification_delivery_channels.sql` defines `push_subscriptions` and own-user RLS | Storage only; endpoint/key validation, rate limits, expiration, token-safe logging, server-only sender, and ownership lifecycle are not implemented or tested. |
| Email integration | PARTIAL | Resend dependency/env names; admin-approval mail helper | Existing use is not notification delivery. No notification adapter, template, retry, unsubscribe, or event webhook path. |
| Email domain verification | BLOCKED | No account/DNS evidence; environment values were not read | Do not send from an unverified domain or claim delivery readiness. |
| Notification preferences | PARTIAL | Profile settings JSON includes three notification-like booleans | No dedicated channel/category model, consent provenance, push preference, or tested opt-out enforcement. |
| Quiet hours | MISSING | No quiet-hour/timezone implementation found | Low-priority reminders could arrive at inappropriate times if later sent without this gate. |
| Frequency caps | MISSING | No cross-channel cap or dedupe logic found | Duplicate/frequent messages could fatigue students and exhaust free quotas. |
| Event processing | PARTIAL | Test-submission route creates a notification record after the submit RPC | One direct insert exists; no typed domain event registry, event status, or generic dispatcher. Submission and notification are not atomic. |
| Queue and workers | MISSING | No queue table/worker/scheduled notification job found | Provider calls or inserts have no durable asynchronous delivery boundary or bounded worker recovery path. |
| Retry mechanism | MISSING | No notification retry state/backoff path found | Transient errors cannot be reliably retried without duplicate risk. |
| Dead-letter queue | MISSING | No notification dead-letter storage or replay interface found | Permanent failures and exhausted retries cannot be safely inspected/recovered. |
| Deduplication | MISSING | No notification event/delivery idempotency key found | Retries or duplicate domain actions may create duplicate records or sends. |
| Templates | PARTIAL | Admin compose UI accepts free-text title/message; admin email has inline escaped HTML | No centralized, versioned notification templates or variable contract. |
| Multilingual support | MISSING | Notification UI/messages are hard-coded English in inspected surfaces | No English/Hindi/Assamese notification catalog, locale fallback, or rendering tests. |
| Admin announcements | PARTIAL | Admin page/API supports immediate global or selected-user in-app inserts | No segment preview, language/channel selection, scheduled send, test account allowlist, campaign state, or cancellation. |
| Delivery tracking | MISSING | Existing notification record creation only; no provider delivery lifecycle | There is no distinction between queued, provider-accepted, delivered, clicked, failed, or expired. |
| Analytics | MISSING | Admin history gives records/count, not delivery metrics | No delivery/channel/usage/click/unsubscribe measurement; no verified provider acceptance data. |
| Unsubscribe | MISSING | No notification unsubscribe or email suppression implementation found | Optional email cannot safely be offered until opt-out/suppression is implemented and tested. |
| Consent tracking | MISSING | No notification consent table/model found | Existing account creation/preferences do not establish channel/category-specific consent. |
| RLS | PARTIAL | `002` establishes broad notification policies; `032` adds receipt RLS; `033` adds subscription RLS; `045` revokes broad notification grants and narrows column grants | SQL intent is present, but live policies/grants and multi-user behavior were not inspected/tested. Subscription table permits authenticated user CRUD on their own row; server-side validation is absent. |
| Rate limiting | PARTIAL | Shared Upstash rate limiting exists for selected authentication routes | No notification send/subscribe/admin campaign limits found; production Redis configuration itself is not re-verified here. |
| Monitoring | MISSING | No notification queue/provider metrics, alerts, or dead-letter dashboard found | Delivery outage or backlog could remain unnoticed. |
| Free-tier protection | MISSING | No notification quota/usage accounting or threshold controls found | Future traffic can exhaust provider quotas or cause unexpected paid overage. |
| Kill switch | MISSING | No global notification dispatch control found | Operators cannot centrally pause optional outbound sends while retaining queued work. |

## Security, reliability, privacy, and production risks

1. **Production/staging and recovery are unknown.** Prior platform audit notes do not establish that the currently linked Supabase project is isolated staging or that a tested backup/restore exists. No notification migration should be applied until environment identity, backup recovery, and staging isolation are confirmed.
2. **No asynchronous durability boundary.** Admin announcements write directly to the notification table; test-submission notification insertion is a separate request-side write. There is no durable outbox, bounded worker, lease/lock, retry state, or DLQ. A request may add latency, and failed/duplicate work is not recoverable in a controlled way.
3. **No enforced consent/routing/caps.** UI JSON toggles are not sufficient evidence that all notification paths check a user's channel/category choices. No frequency cap, quiet-hours gate, time-zone calculation, or global kill switch was found.
4. **RLS is not live-verified.** Repository SQL includes intended own-user controls, a per-user receipt policy, and narrowed grants in migration `045`; the live effective policies/grants and service-role boundary are unknown. The broad initial policy in `002` and later hardening must be assessed as a single migration history, not in isolation.
5. **Push endpoint data is sensitive.** `push_subscriptions` stores endpoints and encryption keys. It has no endpoint validation or expiration lifecycle in the inspected implementation, and no evidence that these values are excluded from logs or protected through a sender-only API because no sender exists.
6. **Email deliverability is unverified.** Resend is used for admin approval only. A configured variable name is not proof of a valid key, sender, verified domain, SPF/DKIM/DMARC, bounce/complaint webhook, or student-notification consent.
7. **No delivery state or free-tier backpressure.** There is no measured usage, quota reservation, throttling, queue preservation policy, or 80% alert. A campaign could exceed a free-tier limit once delivery is added.
8. **Student well-being and audience correctness.** Existing broadcast supports global delivery and manual IDs, without preview counts or student-class verification. The system needs server-side eligibility, educational-only policies for minors, and conservative defaults before adding automatic events.
9. **Result event semantics need correction.** The current submit handler says “Test submitted” but links to a result route and sends the attempt ID in the body. It does not establish that results are published; it must not be relabeled as `result_ready` without verifying the result publication flow.
10. **UI failure reporting is incomplete.** Bell fetch failures are swallowed; read/mark-all requests do not validate response status before updating local state. Users can see stale or success-shaped state when API calls fail.

## Live website and external dependency assessment

- `https://www.xophol.com/notifications` redirected to sign-in when inspected without an authenticated session.
- `https://www.xophol.com/api/notifications?limit=5` returned HTTP 401 without a session, consistent with an authenticated API.
- `https://www.xophol.com/admin/notifications` redirected to admin sign-in.
- No authorized student/admin test credentials were available. No login attempt, data mutation, test-send, or notification delivery was performed.

Official plan/documentation pages were checked on **2026-11-04**. A refresh attempt on **2026-11-11** could not retrieve the Supabase, Vercel, Resend, or OneSignal official pricing pages because of network/DNS errors. The figures below are historical observations from November 4, not verified current allowances. Re-check the linked official pages before choosing a provider, budgeting, or enabling delivery.

| Provider/service | Current official-page evidence | Audit recommendation / caveat |
|---|---|---|
| Resend | [Pricing](https://resend.com/pricing) lists Free at 3,000 emails/month and a 100/day limit, plus three domains; provider webhook and authentication features are listed. | Existing integration makes it the lowest-change candidate for transactional email, subject to current account eligibility, verified Xophol sender domain, DNS authentication, webhook validation, and no-overage controls. Do not claim production delivery yet. |
| OneSignal | [Pricing](https://onesignal.com/pricing) lists a $0 plan and free Web Push with a maximum of 10,000 subscribers per send; other channel terms differ. | Vendor has a faster managed path, but creates vendor dependency and external subscription/audience data handling. Prefer self-hosted VAPID for ownership/privacy if operationally feasible; confirm current browser and plan limitations before a final decision. |
| Supabase | [Pricing](https://supabase.com/pricing) lists Free with 500 MB DB, 50,000 MAU, 5 GB egress and 1 GB file storage; free projects may pause after a week inactive and are limited to two active projects. [Cron docs](https://supabase.com/docs/guides/cron) and [scheduled Edge Function docs](https://supabase.com/docs/guides/functions/schedule-functions) describe PostgreSQL `pg_cron` scheduling and invoking Edge Functions. | Candidate low-cost queue scheduler if the actual project has the required extension/functions and acceptable free-tier behavior. Project plan/quota/configuration and project-specific invocation limits are not verified. |
| Vercel | [Pricing](https://vercel.com/pricing) lists Hobby at $0; limits and available cron behavior depend on current plan documentation. | The repository is deployed on Vercel per existing project docs, but account plan/settings and suitable schedule frequency are unverified. Do not assume it is a dependable worker until checked. |
| iOS Web Push | [Apple Web Push documentation](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers) documents standards-based web push for web apps/browsers. | The implementation must detect and explain the installed Home Screen web-app requirement on supported iOS versions; verify the exact supported iOS/browser matrix during implementation. |

### Initial architecture direction (not implementation approval)

- Adapt the existing notification record/read-receipt model; do not create a duplicate notification center table.
- Add an immutable event/outbox and bounded durable delivery queue only after the actual schema, RLS, staging, and recovery plan are reviewed. Keep domain change and outbox insertion atomic where the existing domain transaction allows it.
- Use a provider-neutral adapter contract. For each channel, return standardized provider acceptance/failure metadata; do not describe provider acceptance as confirmed delivery.
- Start with durable in-app delivery. Consider Supabase `pg_cron` + a protected Edge Function worker if project capability and plan are verified; otherwise evaluate a protected scheduled endpoint on the existing deployment plan. Workers must claim small batches transactionally and be safe to resume.
- Consider self-hosted Web Push with server-only VAPID keys and per-device subscriptions. Ask permission only after a clear contextual explanation; never on initial page load.
- Reuse Resend only after sender-domain verification and consent/unsubscribe controls. The free 100/day limit requires throttling and queue preservation; provider/domain/account state remains a deployment blocker.
- Do not add SMS or WhatsApp now. Keep future channels behind the same adapter registry.
- Realtime is not required for initial correctness. Prefer page/focus refresh and pagination first; enable Realtime only if supported, appropriately secured, quota-aware, and measurably beneficial.

## Prioritized implementation roadmap

No implementation work is authorized by this audit. Every schema addition below is prospective and requires a reviewed, additive migration on isolated staging first.

### P0 — safe prerequisites and trust boundaries

#### P0.1 — Identify environments and verify recovery

- **Description:** Establish which Supabase/Vercel projects are production and staging, verify separate credentials, and test a restorable backup in an isolated environment before any schema change.
- **Dependencies:** Authorized project-owner access.
- **Affected files/systems:** Deployment/Supabase project settings; `DEPLOYMENT.md`; audit/progress docs.
- **Database changes:** None during discovery; later migration only after verified restore point.
- **Risk:** Critical; confusing staging with production or proceeding without recovery may affect live student data.
- **Implementation plan:** Record project refs (not secrets), deployment environments, schema/migration version, backup reference/restore evidence, and rollback path.
- **Tests:** Restore into isolated project; compare schema and confirm no production writes.
- **Acceptance criteria:** Staging is demonstrably isolated; recovery succeeds; production identity and rollback are documented.

#### P0.2 — Verify notification authorization and privacy boundaries

- **Description:** Review effective live RLS/grants, service-role usage, admin role checks, notification reads/updates, and push-subscription ownership with at least two isolated test accounts.
- **Dependencies:** P0.1 and authorized staging accounts.
- **Affected files/systems:** Migrations `002`, `032`, `033`, `045`; notification API routes; auth helpers; Supabase grants/policies.
- **Database changes:** Only narrowly additive/fix migrations after audit; no destructive DDL.
- **Risk:** Critical; cross-user notification/subscription disclosure or unauthorized dispatch.
- **Implementation plan:** Derive final effective permissions from actual schema, add deny-by-default policies/column privileges as needed, and retain server-side role checks.
- **Tests:** User A/B isolation, attempted cross-user update/delete, user event-insert rejection, admin-only operation, unauthenticated access.
- **Acceptance criteria:** All negative authorization tests fail closed on staging; exact policies/grants are documented.

### P1 — reliable, preference-aware core

#### P1.1 — Define event contract and transactional outbox

- **Description:** Define only domain events backed by existing platform behavior, initially verifying result-publication and test-publication paths; persist an immutable, idempotent event with its domain change where possible.
- **Dependencies:** P0.1, P0.2; verified domain/result workflow.
- **Affected files/systems:** Verified result/test publishing routes or RPCs; notification library; Supabase migrations.
- **Database changes:** Add event/outbox fields/table only after checking existing schema; unique idempotency constraint and indexes.
- **Risk:** High; incorrect event timing could reveal unpublished results or target the wrong class.
- **Implementation plan:** Versioned event schema, validated payloads, actor/target, event status and timestamps; reject client-forged events.
- **Tests:** Valid/invalid payloads, duplicate keys, domain rollback atomicity, authorized server-only creation.
- **Acceptance criteria:** Event created exactly once for verified domain transition and never generated by an untrusted client.

#### P1.2 — Add bounded queue, worker, retry, and dead-letter handling

- **Description:** Process outbox deliveries asynchronously in small batches with recoverable claims, attempt limits, jittered exponential backoff, permanent/transient failure classification, and safe DLQ replay.
- **Dependencies:** P0.1, P0.2, P1.1; confirmed scheduler runtime/quotas.
- **Affected files/systems:** Notification core, protected Edge Function or approved worker route, scheduling configuration, migrations.
- **Database changes:** Queue/delivery/DLQ state and indexes as needed; preserve existing notification rows.
- **Risk:** High; double dispatch, stuck jobs, unbounded load, or lost queued events.
- **Implementation plan:** Atomic claim/lease (or row locking), bounded duration/batch, idempotent state transitions, stale-claim recovery, bounded retry schedule, sanitized errors.
- **Tests:** Concurrent workers, process interruption, retries, rate limit, max attempts, permanent errors, DLQ replay, batch cap, queue overflow/backpressure.
- **Acceptance criteria:** Interrupted jobs recover; duplicates are prevented by durable keys; terminal failures are inspectable and safely replayable; no unbounded run.

#### P1.3 — Implement preference, consent, quiet-hours, and frequency policy

- **Description:** Add channel/category preferences and consent provenance; enforce Asia/Kolkata defaults, quiet hours for non-critical items, and a cross-channel non-critical daily cap. Define which actual events qualify as critical.
- **Dependencies:** P1.1 and P1.2; product/legal policy approval for consent and critical exceptions.
- **Affected files/systems:** Preferences/settings UI and API, notification dispatcher, migrations, privacy documentation.
- **Database changes:** Additive preference/consent model only if existing data cannot safely support it; never infer or fabricate prior consent.
- **Risk:** High; unauthorized or excessive communication to minors.
- **Implementation plan:** Default optional external channels off until consent; honor withdrawal immediately; schedule eligible deferred items; expire time-sensitive events with an explicit reason.
- **Tests:** Category/channel opt-out, consent withdrawal, quiet hours across IST boundaries, timezone override, concurrency-safe caps, critical exception, expired event.
- **Acceptance criteria:** Every outbound route checks persisted preferences/consent and shared caps; defaults do not opt existing users into new channels.

#### P1.4 — Build provider-neutral dispatch and in-app reliability

- **Description:** Define the common adapter contract and formalize in-app delivery, including stable delivery IDs, safe retries, read/dismiss state, action URL validation, and explicit UI/API error behavior.
- **Dependencies:** P1.1–P1.3.
- **Affected files/systems:** Existing notification routes/components; new `src/lib/notifications` implementation following existing conventions; migration only where necessary.
- **Database changes:** Additive lifecycle fields or delivery records after reviewing the existing `notifications` schema.
- **Risk:** Medium-high; regression to existing notification history/read semantics.
- **Implementation plan:** Keep current `notifications` and `notification_receipts`; wire the dispatcher to the adapter registry. Make bell/list failures visible and refresh state on focus/reconnect; add cursor/page navigation.
- **Tests:** Existing global/targeted list, read, dismiss, pagination, status errors, access boundaries, retry/idempotency.
- **Acceptance criteria:** In-app notification persists and is retrievable after reload/offline reconnect; user sees real success/failure, and no external channel call blocks user requests.

#### P1.5 — Add multilingual, escaped and versioned templates

- **Description:** Create typed templates for English, Hindi, and Assamese with verified values, variable validation, HTML escaping, and safe language fallback.
- **Dependencies:** P1.1 and verified notification event/payload definitions.
- **Affected files/systems:** Versioned template files, rendering service, test suite.
- **Database changes:** None if templates remain version-controlled; no database template editor required for launch.
- **Risk:** Medium; broken Assamese Unicode, factual mistakes, or unsafe HTML.
- **Implementation plan:** Keep academic facts sourced from existing data; do not machine-translate scores; use constructive student-safe wording.
- **Tests:** Locale rendering, missing/extra variable, Unicode, escaping, fallback and plain-text output.
- **Acceptance criteria:** All selected templates render deterministically in supported languages without unsafe HTML or invented academic data.

#### P1.6 — Add contextual Web Push using self-hosted VAPID

- **Description:** Add a service worker, authenticated subscription lifecycle, push adapter, safe click/deep-link flow, expired-subscription cleanup, and support for multiple devices.
- **Dependencies:** P0.2, P1.2–P1.4; user-facing permission/consent policy.
- **Affected files/systems:** Public service worker/manifest, subscription API, push adapter and secrets configuration.
- **Database changes:** Review/adapt existing `push_subscriptions`; do not recreate it.
- **Risk:** High; subscription tokens are sensitive and browser support varies.
- **Implementation plan:** Generate and store VAPID keys server-side; validate endpoints/keys; rate limit; prompt after contextual value and never on first load; explain iOS installation requirement; send payloads with minimal data.
- **Tests:** Permission denied, valid/invalid subscription, multiple devices, ownership violations, expiry/410 removal, click handling, supported mobile browsers.
- **Acceptance criteria:** End-to-end push is observable only on authorized staging devices; no tokens/secrets in logs or client bundle.

#### P1.7 — Add notification email through the current Resend integration

- **Description:** Provide a provider adapter with HTML/plain-text templates, verified sender/domain, delivery status, webhook signature verification, bounce/complaint suppression, and unsubscribe.
- **Dependencies:** P0.2, P1.2–P1.5; provider account and DNS/domain owner actions.
- **Affected files/systems:** Email adapter, templates, authenticated unsubscribe/webhook routes, setup runbook, provider dashboard/DNS.
- **Database changes:** Minimal suppression/consent/delivery state, if absent; validate against actual schema first.
- **Risk:** High; sending without consent or domain authentication can expose users and damage deliverability.
- **Implementation plan:** Retain Resend only after account, verified domain, SPF/DKIM/DMARC, limit controls and webhook features are confirmed. Respect opt-out; do not use email fallback without preference/consent.
- **Tests:** Escaping, text alternative, unsubscribe and one-click headers, invalid recipient, signed/invalid webhook, transient/permanent provider failures, no full-address/token logs.
- **Acceptance criteria:** Test-recipient-only staging delivery and suppression are verified. Production remains blocked until domain and consent setup are confirmed.

### P2 — controls, launch triggers, and operations

#### P2.1 — Wire verified launch events and eligibility

- **Description:** Implement only event producers confirmed to exist: published results, newly published eligible tests, and other real platform behaviors. Do not add daily quiz, streak, parent, or inactivity events unless those source workflows/data are verified.
- **Dependencies:** P1.1–P1.7; verified domain data and class/board eligibility.
- **Affected files/systems:** Existing domain publish/result flows and the event engine.
- **Database changes:** None beyond approved event/outbox/delivery model.
- **Risk:** High; wrong audience, premature result notification, or made-up weak-topic recommendation.
- **Implementation plan:** Server-side verified audience selection, dedupe, constructive content, authenticated routes; only use actual scoring/material data.
- **Tests:** Published/unpublished result, class/curriculum matching, existing test data, score visibility, weak topic sourced from real score, duplicate event.
- **Acceptance criteria:** Staging events target only eligible test accounts and link to authenticated pages after the underlying data is available.

#### P2.2 — Replace direct admin insert with safe campaign controls

- **Description:** Extend the existing admin composer to preview audience counts/content, require authorized test-send allowlists, schedule/cancel campaigns, enforce minor-safe educational scope, and respect kill switch/preferences.
- **Dependencies:** P0.2 and P1.1–P1.4.
- **Affected files/systems:** Existing admin notification UI/API, campaign/queue processing, admin authorization.
- **Database changes:** Campaign record only if scheduling cannot be represented safely by existing queue; additive schema.
- **Risk:** High; global send could reach all real students.
- **Implementation plan:** Keep current immediate broadcast disabled until the dispatcher/guardrails exist; add explicit audience validation and immutable audit attribution.
- **Tests:** Unauthorized admin, preview count, global-target guard, authorized test-send, scheduling/cancel, preference and kill-switch enforcement.
- **Acceptance criteria:** No production send can happen from preview/test mode; publish requires explicit confirmation, role authorization and validated target.

#### P2.3 — Add global kill switch, usage protection, monitoring and analytics

- **Description:** Provide an auditable pause for non-critical dispatch, preserve queued events, measure provider acceptance separately from confirmed delivery, and throttle based on verified free-tier quotas.
- **Dependencies:** P1.2–P1.7 and authorized admin design.
- **Affected files/systems:** Dispatcher, admin operations view, queue/delivery state, low-cost platform alerts.
- **Database changes:** Auditable switch/usage state as needed after schema review.
- **Risk:** High; an ineffective kill switch or incorrect “delivered” metric creates operational harm.
- **Implementation plan:** Critical exception policy documented and narrow; track sent/accepted/confirmed/failed separately; alert at 80% of verified allowance; keep in-app channel available if external channel is throttled.
- **Tests:** Pause/resume, queued-event preservation, critical policy, quota threshold, provider outage, backlog alert, measured-vs-estimated dashboard values.
- **Acceptance criteria:** Pause blocks only policy-defined non-critical outbound work; no event is silently discarded; dashboards label delivery semantics accurately.

### P3 — optional maturity improvements

- Add cursor-based archive/retention, digest mode, and aggregate engagement reporting only after core reliability and consent are proven.
- Add official exam countdown only from an admin-configured verified date.
- Add additional provider adapters (including future SMS/WhatsApp) without changing core event/preference/queue contracts.
- Consider Realtime only after measuring user benefit and confirming channel publication/RLS, quotas, reconnection behavior, and fallback fetch.

### P4 — optional features not in initial delivery

- Parent weekly reports are **not applicable until** verified parent-child relationships, authorization, consent, and any required legal controls exist.
- A/B testing and smart-delivery optimization are deferred; avoid pressure-based engagement metrics and do not build ML infrastructure without adequate reliable data.

## Approval gate

The user approved the audit and roadmap and authorized Phase 2 prerequisites. **No code/database implementation has started.** P0.1 remains blocked; before any migration or delivery work, establish isolated staging and a verified recovery path, then complete P0.2 on staging.

## Post-approval prerequisite check

The user approved the audit/roadmap and authorized Phase 2 prerequisites. The following additional checks were read-only:

- Supabase CLI `2.118.0` is installed. The CLI-linked project is named `Xophol`; the user confirmed it is **production**. Its reference matches the Supabase host configured in local `.env.local`; the URL value itself was not emitted. Do not run local app flows, tests, or scripts that use this file against Supabase until staging credentials replace the production endpoint.
- The accessible-project listing showed one project; no separate isolated staging project was confirmed.
- `supabase backups list` returned no physical backup records and reported PITR disabled for the linked project. No local backup/export file was found in the repository. Backup integrity and restoration therefore remain unverified; no backup was created.
- `supabase migration list --linked` failed during the read-only Postgres connection (`Connection terminated unexpectedly`). No schema/policy query or migration was performed.
- Local Vercel project metadata identifies `xopholweb`, but it does not identify a current deployment or prove an isolated preview/staging environment. The Vercel CLI is not installed.
- The worktree remains dirty with pre-existing and newly observed user changes. No feature branch was created and no changes were stashed, committed, or discarded.

**P0.1 is BLOCKED.** Do not alter production until an isolated staging environment and verified recovery point exist. A plan with no visible physical backups and PITR disabled must not be treated as recoverable.

### Safe no-cost path to clear P0.1

1. **Keep production untouched.** Do not run app mutations, migrations, live tests, seed scripts, or notification sends while `.env.local` targets production. Never put production credentials in a staging environment.
2. **Create staging only with owner authorization.** In the existing Supabase account, first verify that the free-plan project quota permits a second project. Create a separate project with separate credentials and use synthetic/test-only accounts and data. Current official Supabase pricing lists two active free projects and says free projects may pause after one week of inactivity; do not assume guaranteed uptime or backups. Do not copy real student/production records into staging.
3. **Separate local app configuration.** Configure local/staging-only Supabase URL and anon/service credentials in an ignored local env file; verify that its project ref is the staging ref before any mutation. Keep production credentials outside local development and CI.
4. **Establish a production recovery point without adding paid services.** Ask the project owner/data custodian to identify an existing provider export/backup with restore instructions. If none exists, first restore database connectivity and have the authorized owner evaluate a secure logical export (`pg_dump`/Supabase-supported export) to encrypted, access-controlled storage, with checksum and retention recorded. A logical export is **not** accepted as a verified backup until its restore is tested in an isolated environment. Do not create or restore a production-data copy into shared staging; use a restricted, disposable recovery environment only under explicit data-owner/privacy approval. If there is no safe, no-cost, restorable backup path on the current plan, stop production migrations until one is arranged.
5. **Verify staging recovery and authorization.** Use synthetic fixtures to verify schema migration/restore mechanics and student A/B RLS boundaries, record evidence, and only then proceed to P0.2.

These are setup instructions, not proof that staging, backups, restore, or legal approval exist. No cloud project was created, no production backup was initiated, and no credentials were changed by this audit.

## Read-only audit refresh — 2026-11-11

### Current repository and scope

- Branch remains `fix/admin-results-refresh`; latest commit remains `9365ac4` (`Sequence mock test migration after existing migrations`).
- The worktree is dirty with unrelated existing changes to `package.json`, `package-lock.json`, `next-env.d.ts`, analytics/auth/SEO code, and tests. The notification audit/progress documents are untracked. No existing changes were reverted or overwritten.
- Rechecked the current notification schema and implementation, environment-variable **names only**, package scripts/dependencies, CI/deployment documentation, workflow and service-worker inventory, and public production routes.
- The app is Next.js `^16.3.8` with React 19 and Supabase SSR/client libraries. Repository migrations define the existing `notifications`, `notification_receipts`, and `push_subscriptions` tables. No event/outbox/notification-delivery worker or notification-specific test suite was found.
- `DEPLOYMENT.md` identifies Vercel/Supabase operating procedures and Resend configuration for admin-approval email; it does not evidence an active deployment identity, notification provider readiness, or isolated staging. `.github/workflows/ci.yml` runs typecheck, unit tests, and build; its production-readiness job validates configuration but does not deploy or verify notification delivery.
- The checked-in `supabase/config.toml` enables local Realtime, but this does not prove that the linked project's production Realtime publication includes notification tables or that the app subscribes to them.
- Read-only public checks on `www.xophol.com` again observed `/notifications` and `/settings` redirect to sign-in, `/admin/notifications` redirect to admin sign-in, and `/api/notifications` return HTTP 401 without authentication. The homepage identifies the platform as serving Class 9/10 students and CBSE/SEBA Assam. These checks do not verify authenticated behavior.

### Pricing and external-service evidence

Current official pricing could not be independently refreshed on November 11: requests to Supabase, Vercel, Resend, and OneSignal pricing pages failed at DNS/transport retrieval. The November 4 figures retained above are therefore **not current verification**. Provider free allowances, terms, scheduling limits, account status, DNS verification, and upgrade requirements remain **BLOCKED / UNVERIFIED**. Do not select or enable an external provider based solely on those historical figures.

### Audit safety and remaining blockers

- No application code, database schema/data, environment values, production settings, or deployment configuration was changed. No migration, app test, authenticated action, or notification send was run.
- Local environment inspection emitted variable names only; secret values were not read or disclosed.
- Remote DB inspection remains prohibited until the project owner supplies isolated staging and a verified recovery path. The historical read-only connection attempt failed; live schema, effective RLS/grants, and Realtime publication remain unverified.
- No authorized student/admin test credentials were available. Production/staging deployment identity, actual provider accounts, current quotas, and sender-domain DNS verification remain unverified.
- This is the initial audit phase. **Do not begin implementation until the audit and roadmap receive explicit approval and the P0 recovery/staging/security gates are cleared.**
