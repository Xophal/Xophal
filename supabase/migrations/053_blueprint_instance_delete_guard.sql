CREATE OR REPLACE FUNCTION public.prevent_blueprint_delete_with_instances()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.test_instances instance
    WHERE instance.blueprint_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'Blueprint has generated test instances and cannot be deleted.'
      USING ERRCODE = '23503',
            CONSTRAINT = 'blueprints_have_test_instances';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_blueprint_delete_with_instances ON public.blueprints;
CREATE TRIGGER trg_prevent_blueprint_delete_with_instances
  BEFORE DELETE ON public.blueprints
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_blueprint_delete_with_instances();
