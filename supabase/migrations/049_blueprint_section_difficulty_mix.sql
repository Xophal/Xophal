ALTER TABLE public.blueprint_sections
  ADD COLUMN IF NOT EXISTS difficulty_mix JSONB NOT NULL DEFAULT '{}'::JSONB;
