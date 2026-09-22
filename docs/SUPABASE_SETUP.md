Supabase setup and local migration guide

1. Create a Supabase project

- Go to https://app.supabase.com and create a new project.
- Note the project URL (e.g. https://abcd1234.supabase.co) and the anon/public and service role keys.

2. Add environment variables

- Copy `.env.example` to `.env.local` and fill the following values:

  - `NEXT_PUBLIC_SUPABASE_URL` — your Supabase project URL
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon/public API key
  - `SUPABASE_SERVICE_ROLE_KEY` — service role key (sensitive)
  - `NEXT_PUBLIC_APP_URL` — optional app URL (defaults to http://localhost:3000)
  - `SUPABASE_PROJECT_REF` — optional CLI project ref used by `supabase link`

3. Install Supabase CLI (optional, recommended for migrations and local dev)

```bash
# macOS / Linux
npm install -g supabase
# Windows (PowerShell)
npm install -g supabase
```

4. Link your local repo to the Supabase project (optional but convenient)

```bash
supabase login
supabase link --project-ref <YOUR_PROJECT_REF>
```

5. Apply database migrations

- The repository contains SQL migrations in the `supabase/migrations/` directory.
- To apply migrations to your remote project, run:

```bash
supabase db push
```

- To run a local Supabase instance (for full emulation), run:

```bash
supabase start
# then inside the running local instance you can push migrations
supabase db push
```

6. Generate TypeScript types for the database (optional but recommended)

```bash
npm run db:types
# or
npx supabase gen types typescript --local > src/types/database.types.ts
```

7. Seed data

- If you want to seed data, inspect `supabase/migrations/003_seed_data.sql` and apply it via the Supabase SQL editor or run it locally against your DB.

8. Notes and troubleshooting

- Do NOT commit `SUPABASE_SERVICE_ROLE_KEY` to version control.
- If you run into permission issues, ensure RLS policies in `supabase/migrations/002_rls_policies.sql` are applied.
- If you need to reset a remote database, use the Supabase dashboard — this project contains migration SQL but remote reset commands are destructive.

If you want, I can also add npm scripts to help run the common Supabase CLI commands from this project.