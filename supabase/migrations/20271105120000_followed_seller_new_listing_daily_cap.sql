-- Shared daily cap for Followed Seller New Listing.
-- One row per follower and listing. At most two rows per follower per
-- America/Los_Angeles calendar day (the app passes that date). Email and
-- in-app both call this, so neither channel can pass the cap on its own.
-- A retry of the same listing hits the primary key and does not take another slot.
-- Must match FOLLOWED_SELLER_NEW_LISTING_DAILY_CAP in lib/services/notifications/catalog.ts.

CREATE TABLE IF NOT EXISTS public.followed_seller_listing_alert_grants (
  recipient_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  listing_id uuid NOT NULL,
  day_key date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (recipient_id, listing_id)
);

COMMENT ON TABLE public.followed_seller_listing_alert_grants IS
  'Claims for Followed Seller New Listing. Two per recipient per day_key, shared by email and in-app. day_key is an America/Los_Angeles calendar date.';

CREATE INDEX IF NOT EXISTS followed_seller_listing_alert_grants_day_idx
  ON public.followed_seller_listing_alert_grants (recipient_id, day_key);

ALTER TABLE public.followed_seller_listing_alert_grants ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.followed_seller_listing_alert_grants FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.followed_seller_listing_alert_grants TO service_role;

CREATE OR REPLACE FUNCTION public.claim_followed_seller_listing_alerts(
  p_listing_id uuid,
  p_recipient_ids uuid[],
  p_day_key date
)
RETURNS TABLE (recipient_id uuid, status text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_recipient uuid;
  v_count integer;
  v_cap constant integer := 2;
BEGIN
  IF p_listing_id IS NULL OR p_day_key IS NULL THEN
    RAISE EXCEPTION 'listing and day are required';
  END IF;
  IF p_recipient_ids IS NULL THEN
    RETURN;
  END IF;

  FOR v_recipient IN
    SELECT DISTINCT id
    FROM unnest(p_recipient_ids) AS ids(id)
    WHERE id IS NOT NULL
    ORDER BY id
  LOOP
    -- One lock per follower so two listings published together cannot both pass the count.
    PERFORM pg_advisory_xact_lock(
      hashtextextended('followed-seller-new-listing:' || v_recipient::text, 0)
    );

    IF EXISTS (
      SELECT 1
      FROM public.followed_seller_listing_alert_grants g
      WHERE g.recipient_id = v_recipient
        AND g.listing_id = p_listing_id
    ) THEN
      recipient_id := v_recipient;
      status := 'already_granted';
      RETURN NEXT;
      CONTINUE;
    END IF;

    SELECT count(*)::integer INTO v_count
    FROM public.followed_seller_listing_alert_grants g
    WHERE g.recipient_id = v_recipient
      AND g.day_key = p_day_key;

    IF v_count >= v_cap THEN
      recipient_id := v_recipient;
      status := 'capped';
      RETURN NEXT;
      CONTINUE;
    END IF;

    BEGIN
      INSERT INTO public.followed_seller_listing_alert_grants (recipient_id, listing_id, day_key)
      VALUES (v_recipient, p_listing_id, p_day_key);
    EXCEPTION
      WHEN unique_violation THEN
        recipient_id := v_recipient;
        status := 'already_granted';
        RETURN NEXT;
        CONTINUE;
    END;

    recipient_id := v_recipient;
    status := 'granted';
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_followed_seller_listing_alerts(uuid, uuid[], date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_followed_seller_listing_alerts(uuid, uuid[], date) TO service_role;
