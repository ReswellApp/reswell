-- Accounts keep many saved searches (the app caps the count).
-- A unique index on user_id alone, or on (user_id, email_notifications_enabled),
-- rejects every save after the first when email alerts are on. Drop those if present.

DO $$
DECLARE
  constraint_name text;
  index_name text;
BEGIN
  FOR constraint_name IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.saved_searches'::regclass
      AND c.contype = 'u'
      AND (
        SELECT array_agg(a.attname ORDER BY a.attname)
        FROM pg_attribute a
        WHERE a.attrelid = c.conrelid
          AND a.attnum = ANY (c.conkey)
      ) IN (
        ARRAY['user_id']::name[],
        ARRAY['email_notifications_enabled', 'user_id']::name[]
      )
  LOOP
    EXECUTE format(
      'ALTER TABLE public.saved_searches DROP CONSTRAINT IF EXISTS %I',
      constraint_name
    );
  END LOOP;

  FOR index_name IN
    SELECT ic.relname
    FROM pg_index i
    JOIN pg_class t ON t.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_class ic ON ic.oid = i.indexrelid
    WHERE n.nspname = 'public'
      AND t.relname = 'saved_searches'
      AND i.indisunique
      AND NOT i.indisprimary
      AND (
        SELECT array_agg(a.attname ORDER BY a.attname)
        FROM pg_attribute a
        WHERE a.attrelid = t.oid
          AND a.attnum = ANY (i.indkey)
          AND a.attnum > 0
      ) IN (
        ARRAY['user_id']::name[],
        ARRAY['email_notifications_enabled', 'user_id']::name[]
      )
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS public.%I', index_name);
  END LOOP;
END $$;
