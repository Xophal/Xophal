# Notification architecture

## Objective

The Xophol notification system must be event-driven, provider-neutral, privacy-aware, and safe for a student audience that includes minors. The design below keeps the current in-app notification tables and reads, while defining a provider-agnostic core that can later support push, email, SMS, and WhatsApp without rewriting the event or preference model.

## Core design

1. Domain events are authored only by verified server-side workflows.
2. Events are persisted as immutable records before dispatch.
3. A bounded outbox/queue stores pending work.
4. A worker claims a batch, applies eligibility/preference checks, and dispatches through channel adapters.
5. Delivery results are tracked separately from provider acceptance and from actual receipt confirmation.
6. In-app notifications remain the durable default and cannot be silently discarded.

## Event lifecycle

```text
Domain action
  -> server-side event creation
  -> transactional event record
  -> outbox row / queued job
  -> worker claims batch
  -> eligibility + preference checks
  -> quiet hours + frequency caps
  -> template rendering
  -> channel router
  -> adapter execution
  -> delivery audit / analytics
  -> retry or dead-letter handling
```

## Database model

The repository already contains a partial in-app notification layer:

- `notifications` table for user/global notification records
- `notification_receipts` for per-user read/dismiss state
- `push_subscriptions` for browser push endpoints

The implementation should preserve these tables where possible and add only the missing event-driven metadata needed to make them reliable:

- `notification_events` (immutable event log)
- `notification_queue` (task rows for dispatch)
- `notification_deliveries` (provider attempt records)
- `notification_dead_letters` (terminal failure records)
- `notification_preferences` (channel/category/location controls)
- `notification_consents` (field-level consent provenance)
- `notification_usage` (quota tracking)

All schema changes must be additive, reviewed, staged, and not destructive to production data.

## Worker and queue

The worker should process a small batch at a time and must enforce:

- max batch size
- per-job lease/locking
- exponential backoff with jitter
- retry classification (transient, permanent, rate-limited, invalid recipient)
- dead-letter transition after maximum attempts
- queue backpressure and overflow protection
- ability to resume after interruption

This is implemented as a provider-neutral queue contract in `src/lib/notifications` and is ready for a database-backed execution path once staging and backups are verified.

## Channel adapters

Each adapter implements the contract in `src/lib/notifications/types.ts`:

- `send(notification)`
- `validate(notification)`
- `handleFailure(error, context)`
- `checkAvailability()`
- `getUsage()`
- `processWebhook(payload)` when provider webhooks are supported

This keeps the core engine free from provider-specific logic. A future SMS or WhatsApp adapter should only need to implement the same contract and register itself in the adapter registry.

## Template and locale strategy

Templates are centralized and versioned in the notification library.

Supported locales:

- English (`en`)
- Hindi (`hi`)
- Assamese (`as`)

The template engine renders values safely and validates variables before sending. Empty or missing values are handled with safe fallback strings rather than exposing raw data.

## Preferences and quiet hours

At the minimum, the system must support:

- channel enablement: in-app, push, email
- category toggles for results/tests/learning/announcements
- timezone
- quiet hours
- daily non-critical cap
- critical exception policy

The default policy should be Asia/Kolkata with a quiet-hours window of 22:00–07:00 IST, while preserving critical transactional alerts under an explicit exception policy.

## Security boundaries

- Students must only read their own notifications and update only their own read state or preferences.
- Server-side code must place all domain events; clients cannot create arbitrary notification events.
- Only trusted worker/admin routes may send external notifications.
- Push payloads must not contain personal data, tokens, or internal IDs beyond a safe route identifier.
- Email unsubscribe and provider webhooks must be verified and signed where applicable.

## Monitoring

The production implementation must measure and alert separately on:

- provider acceptance
- confirmed delivery
- opened/clicked events, when measurable
- queue backlog
- dead-letter count
- quota usage
- delivery latency

## Deployment status

This repository contains the initial in-app notification shell and a notification utility library scaffold, but the live staging, backup, and provider verification gates remain unresolved. The architecture is therefore ready for implementation in a safe environment, not for production activation.
