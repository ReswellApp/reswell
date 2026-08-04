-- Seller ban: admins can revoke selling privileges without blocking purchases.
-- Banned sellers' live inventory moves to status `delinquent` (hidden, not deleted).

BEGIN;

-- ---------------------------------------------------------------------------
-- profiles: seller ban flag
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS seller_banned_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS seller_banned_reason text NULL;

COMMENT ON COLUMN public.profiles.seller_banned_at IS
  'When set, the user cannot sell or make listings live. Purchases remain allowed. Listings are moved to delinquent.';
COMMENT ON COLUMN public.profiles.seller_banned_reason IS
  'Internal admin note for why the seller was banned.';

CREATE OR REPLACE FUNCTION public.profiles_guard_seller_ban_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.seller_banned_at IS DISTINCT FROM OLD.seller_banned_at
     OR NEW.seller_banned_reason IS DISTINCT FROM OLD.seller_banned_reason THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_admin IS TRUE
    ) THEN
      -- Allow service_role (auth.uid() null) and admins; block self-service clears.
      IF auth.uid() IS NOT NULL THEN
        NEW.seller_banned_at := OLD.seller_banned_at;
        NEW.seller_banned_reason := OLD.seller_banned_reason;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_seller_ban ON public.profiles;
CREATE TRIGGER profiles_guard_seller_ban
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_guard_seller_ban_fields();

-- ---------------------------------------------------------------------------
-- listings.status: add delinquent
-- ---------------------------------------------------------------------------
-- Drop by name first. Avoid LIKE '%status%' — that also matches
-- listings_site_visibility_reason_check (value 'admin_status').
ALTER TABLE public.listings
  DROP CONSTRAINT IF EXISTS listings_status_check;

DO $$
DECLARE
  cname text;
BEGIN
  -- Legacy unnamed/renamed status CHECKs (def contains status IN (...)).
  FOR cname IN
    SELECT con.conname
    FROM pg_constraint con
    WHERE con.conrelid = 'public.listings'::regclass
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ~ 'status\s+IN\s*\('
  LOOP
    EXECUTE format('ALTER TABLE public.listings DROP CONSTRAINT %I', cname);
  END LOOP;
END $$;

ALTER TABLE public.listings
  ADD CONSTRAINT listings_status_check CHECK (
    status IN (
      'active',
      'sold',
      'pending',
      'removed',
      'pending_sale',
      'draft',
      'delinquent'
    )
  );

COMMENT ON CONSTRAINT listings_status_check ON public.listings IS
  'Listing lifecycle: delinquent = seller-ban hold (hidden, not deleted; not publicly discoverable).';

-- ---------------------------------------------------------------------------
-- site_visibility_reason: seller_ban
-- ---------------------------------------------------------------------------
ALTER TABLE public.listings
  DROP CONSTRAINT IF EXISTS listings_site_visibility_reason_check;

ALTER TABLE public.listings
  ADD CONSTRAINT listings_site_visibility_reason_check CHECK (
    site_visibility_reason IS NULL
    OR site_visibility_reason IN (
      'seller_vacation',
      'seller_inactivity',
      'admin_site_visibility',
      'seller_archive',
      'admin_status',
      'system',
      'seller_ban'
    )
  );

COMMENT ON COLUMN public.listings.site_visibility_reason IS
  'Why hidden_from_site is true. Includes seller_ban for delinquent seller-ban holds.';

-- ---------------------------------------------------------------------------
-- Enforce: banned sellers cannot keep/create live inventory
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.listings_enforce_seller_ban()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  banned boolean;
BEGIN
  SELECT p.seller_banned_at IS NOT NULL
  INTO banned
  FROM public.profiles p
  WHERE p.id = NEW.user_id;

  IF COALESCE(banned, false) THEN
    IF NEW.status IN ('active', 'pending_sale', 'pending') THEN
      NEW.status := 'delinquent';
      NEW.hidden_from_site := true;
      NEW.site_visibility_reason := 'seller_ban';
    ELSIF NEW.status = 'delinquent' THEN
      NEW.hidden_from_site := true;
      NEW.site_visibility_reason := COALESCE(NEW.site_visibility_reason, 'seller_ban');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS listings_enforce_seller_ban ON public.listings;
CREATE TRIGGER listings_enforce_seller_ban
  BEFORE INSERT OR UPDATE ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.listings_enforce_seller_ban();

COMMIT;
