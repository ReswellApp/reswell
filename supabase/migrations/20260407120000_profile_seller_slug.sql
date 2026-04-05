-- URL-safe public slug for /sellers/[slug], derived from shop name (shops) or display name.

CREATE OR REPLACE FUNCTION public.slugify_profile_label(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(
    trim(both '-' FROM lower(regexp_replace(coalesce(trim(raw), ''), '[^a-zA-Z0-9]+', '-', 'g'))),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.assign_seller_slug_for_profile(p public.profiles)
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  label text;
  base text;
  candidate text;
  n int := 0;
BEGIN
  IF p.is_shop AND nullif(trim(p.shop_name), '') IS NOT NULL THEN
    label := trim(p.shop_name);
  ELSIF nullif(trim(p.display_name), '') IS NOT NULL THEN
    label := trim(p.display_name);
  ELSE
    label := 'seller';
  END IF;

  base := coalesce(public.slugify_profile_label(label), 'seller');
  IF base = '' OR base IS NULL THEN
    base := 'seller';
  END IF;

  candidate := base;
  WHILE EXISTS (
    SELECT 1 FROM public.profiles
    WHERE seller_slug = candidate
      AND id IS DISTINCT FROM p.id
  ) LOOP
    n := n + 1;
    candidate := base || '-' || n::text;
  END LOOP;

  RETURN candidate;
END;
$$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS seller_slug text;

-- Backfill in stable order so first-come keeps the base slug.
DO $$
DECLARE
  r public.profiles%ROWTYPE;
BEGIN
  FOR r IN
    SELECT * FROM public.profiles ORDER BY created_at ASC NULLS LAST, id ASC
  LOOP
    UPDATE public.profiles
    SET seller_slug = public.assign_seller_slug_for_profile(r)
    WHERE id = r.id;
  END LOOP;
END;
$$;

ALTER TABLE public.profiles
  ALTER COLUMN seller_slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_seller_slug_key
  ON public.profiles (seller_slug);

CREATE OR REPLACE FUNCTION public.sync_profile_seller_slug()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF tg_op = 'INSERT' THEN
    new.seller_slug := public.assign_seller_slug_for_profile(new);
    RETURN new;
  END IF;
  IF tg_op = 'UPDATE' THEN
    new.seller_slug := public.assign_seller_slug_for_profile(new);
    RETURN new;
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS profile_seller_slug_insert ON public.profiles;
DROP TRIGGER IF EXISTS profile_seller_slug_update ON public.profiles;

-- INSERT: always set slug (auth may omit display_name in column list for OF-column triggers).
CREATE TRIGGER profile_seller_slug_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_seller_slug();

CREATE TRIGGER profile_seller_slug_update
  BEFORE UPDATE OF display_name, shop_name, is_shop ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_seller_slug();
