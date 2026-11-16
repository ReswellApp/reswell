-- One migration for this checkout/shipping fix:
-- 1. Release orphaned unique-item holds ("This item is no longer available").
-- 2. Put leftover surfboard cartons back on the right category (or strip them).
-- 3. Retire Compact / Medium pack-band identity.

-- ---------------------------------------------------------------------------
-- Holds
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.expire_stale_checkout_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.checkout_stock_holds h
  SET status = 'released'
  WHERE h.status = 'held'
    AND (
      h.expires_at < now()
      OR NOT EXISTS (
        SELECT 1
        FROM public.checkout_sessions s
        WHERE s.id = h.session_id
          AND s.status = 'open'
      )
    );

  UPDATE public.checkout_sessions
  SET status = 'expired',
      updated_at = now()
  WHERE status = 'open'
    AND expires_at < now();

  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.checkout_stock_holds h
  SET status = 'released'
  WHERE h.status = 'held'
    AND NOT EXISTS (
      SELECT 1
      FROM public.checkout_sessions s
      WHERE s.id = h.session_id
        AND s.status = 'open'
    );

  DELETE FROM public.checkout_stock_holds
  WHERE status IN ('captured', 'released')
    AND created_at < now() - interval '14 days';

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.expire_stale_checkout_sessions() IS
  'Expires open sessions past TTL, releases holds for non-open sessions, and deletes terminal stock holds older than 14 days.';

CREATE OR REPLACE FUNCTION public.reserve_checkout_session_stock(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.checkout_sessions%ROWTYPE;
  v_item public.checkout_session_items%ROWTYPE;
  v_listing public.listings%ROWTYPE;
  v_held integer;
  v_available integer;
  v_stock_backed boolean;
BEGIN
  SELECT * INTO v_session
  FROM public.checkout_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'reserve_checkout_session_stock: session % not found', p_session_id;
  END IF;

  PERFORM public.release_checkout_session_stock(p_session_id);

  -- Unique index is on every held unique row, including holds whose session
  -- was expired without a matching release. Clear those before we re-hold.
  UPDATE public.checkout_stock_holds h
  SET status = 'released'
  WHERE h.status = 'held'
    AND NOT EXISTS (
      SELECT 1
      FROM public.checkout_sessions s
      WHERE s.id = h.session_id
        AND s.status = 'open'
        AND s.expires_at > now()
    );

  FOR v_item IN
    SELECT * FROM public.checkout_session_items WHERE session_id = p_session_id
  LOOP
    SELECT * INTO v_listing
    FROM public.listings
    WHERE id = v_item.listing_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'reserve_checkout_session_stock: listing % not found', v_item.listing_id;
    END IF;

    v_stock_backed := NOT v_item.unique_item;

    IF v_item.unique_item THEN
      IF EXISTS (
        SELECT 1
        FROM public.checkout_stock_holds h
        JOIN public.checkout_sessions s ON s.id = h.session_id
        WHERE h.listing_id = v_item.listing_id
          AND h.status = 'held'
          AND h.unique_item = true
          AND h.expires_at > now()
          AND s.status = 'open'
          AND s.expires_at > now()
      ) THEN
        RAISE EXCEPTION 'reserve_checkout_session_stock: listing % already reserved', v_item.listing_id
          USING ERRCODE = 'unique_violation';
      END IF;
      IF v_listing.status IS DISTINCT FROM 'active' AND v_listing.status IS DISTINCT FROM 'pending_sale' THEN
        RAISE EXCEPTION 'reserve_checkout_session_stock: listing % is not available', v_item.listing_id
          USING ERRCODE = 'unique_violation';
      END IF;
    ELSE
      SELECT COALESCE(SUM(h.quantity), 0) INTO v_held
      FROM public.checkout_stock_holds h
      JOIN public.checkout_sessions s ON s.id = h.session_id
      WHERE h.listing_id = v_item.listing_id
        AND h.status = 'held'
        AND h.expires_at > now()
        AND s.status = 'open'
        AND s.expires_at > now();

      v_available := GREATEST(0, COALESCE(v_listing.stock_quantity, 0) - v_held);
      IF v_available < v_item.quantity THEN
        RAISE EXCEPTION 'reserve_checkout_session_stock: insufficient stock for listing %', v_item.listing_id
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;

    INSERT INTO public.checkout_stock_holds (
      session_id,
      listing_id,
      quantity,
      unique_item,
      status,
      expires_at
    ) VALUES (
      p_session_id,
      v_item.listing_id,
      v_item.quantity,
      v_item.unique_item,
      'held',
      v_session.expires_at
    );
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- Cartons: leftover surfboard boxes on gear → that category's mailer
-- ---------------------------------------------------------------------------

update public.listings
set
  shipping_package_tier = null,
  shipping_package_band = null,
  shipping_packed_length_in = case section
    when 'fins' then 10
    when 'leashes' then 12
    when 'traction' then 12
    when 'magazines' then 12
    when 'accessories' then 12
    when 'apparel' then 18
    when 'wetsuits' then 18
    when 'boardbags' then 36
    when 'surfpacks' then 36
    else null
  end,
  shipping_packed_width_in = case section
    when 'fins' then 7
    when 'leashes' then 10
    when 'traction' then 10
    when 'magazines' then 10
    when 'accessories' then 10
    when 'apparel' then 14
    when 'wetsuits' then 14
    when 'boardbags' then 16
    when 'surfpacks' then 16
    else null
  end,
  shipping_packed_height_in = case section
    when 'fins' then 4
    when 'leashes' then 4
    when 'traction' then 4
    when 'magazines' then 4
    when 'accessories' then 4
    when 'apparel' then 6
    when 'wetsuits' then 6
    when 'boardbags' then 8
    when 'surfpacks' then 8
    else null
  end,
  shipping_packed_weight_oz = case section
    when 'fins' then 48
    when 'leashes' then 32
    when 'traction' then 32
    when 'magazines' then 32
    when 'accessories' then 32
    when 'apparel' then 48
    when 'wetsuits' then 48
    when 'boardbags' then 96
    when 'surfpacks' then 96
    else null
  end
where section is distinct from 'surfboards'
  and (
    shipping_package_tier is not null
    or shipping_package_band is not null
    or coalesce(shipping_packed_length_in, 0) > 48
  );

alter table public.listings
  drop constraint if exists listings_shipping_package_tier_section_check;

alter table public.listings
  add constraint listings_shipping_package_tier_section_check
  check (
    (
      shipping_package_tier is null
      and shipping_package_band is null
    )
    or section = 'surfboards'
  );

comment on constraint listings_shipping_package_tier_section_check on public.listings is
  'shipping_package_tier is surfboard-only. Gear stores packed L×W×H with a null tier.';

alter table public.listings
  drop constraint if exists listings_gear_packed_length_section_check;

alter table public.listings
  add constraint listings_gear_packed_length_section_check
  check (
    section = 'surfboards'
    or shipping_packed_length_in is null
    or (
      shipping_packed_length_in >= 4
      and shipping_packed_length_in <= 48
    )
  );

comment on constraint listings_gear_packed_length_section_check on public.listings is
  'Non-surfboard listings cannot store a board-length carton. Each gear section uses its own small-parcel box.';

-- ---------------------------------------------------------------------------
-- Retire Compact / Medium pack-band carton identity
-- ---------------------------------------------------------------------------

update public.listings
set shipping_package_band = null
where shipping_package_band is not null;

alter table public.listings
  drop constraint if exists listings_shipping_package_band_check;

alter table public.listings
  add constraint listings_shipping_package_band_check
  check (shipping_package_band is null);

comment on column public.listings.shipping_package_band is
  'Unused. Stock shortboard pack bands were removed; packed L×W×H is the carton.';

comment on constraint listings_shipping_package_band_check on public.listings is
  'Pack-band carton identity is retired. New writes leave this column null.';
