# Phase 3 — Test Blueprints and Generator

## Delivered

- The deterministic seeded generator, difficulty quotas, recency exclusion,
  constraint relaxation, availability reporting, and adaptive selection live in
  `src/lib/engine/generator.ts` and `src/lib/engine/blueprint-service.ts`.
- Admin CRUD and the read-only question-bank availability endpoint are exposed
  by `src/app/api/admin/engine/blueprints/route.ts` and its `[id]` route.
- The admin editor is available at `/admin/engine/blueprints`, with section
  ordering, question counts, marks, topic/type/skill/board/tag filters,
  difficulty bands and mix, and a published-question availability check.
- Navigation links to the editor from the admin sidebar and dashboard.
- The existing generator suite covers deterministic output, unique picks,
  difficulty mix, shortfalls, relaxation, availability, and adaptive selection.

## Data safety

Deleting a blueprint would cascade through generated test instances and their
attempt data. The admin API pre-checks for instances and migration
`053_blueprint_instance_delete_guard.sql` adds a database trigger to close the
race between that check and deletion. Deletion returns
`BLUEPRINT_HAS_INSTANCES` (HTTP 409) when any instance exists. Blueprints
without instances may still be deleted. The migration has not been applied to
any database.

Blueprints linked to legacy mock tests are visible but read-only in this editor;
their source mock-test workflow remains authoritative.

The availability check is read-only. It inspects the published question pool
loaded by the server and does not create a test instance. Generation previews
use a separate endpoint that persists a frozen instance; the editor does not
call it.

## Verification

Run the checks from the repository root:

```powershell
& 'D:\Program Files\node.exe' .\node_modules\typescript\bin\tsc --noEmit
& 'D:\Program Files\node.exe' .\node_modules\vitest\vitest.mjs run tests\unit\phase3-generator.test.ts
& 'D:\Program Files\node.exe' .\node_modules\next\dist\bin\next build
```

The editor still requires an authenticated admin and a configured Supabase
environment to exercise end-to-end. Validate create/edit/availability and the
delete guard against staging before production use.
