-- Admin-pilot Reswell Bucks checkout.
-- One settlement is a balanced journal: buyer spend + promo subsidy
-- = seller pending earnings + platform fee + shipping clearing.
-- Carrier labels later move shipping clearing to a cash bridge so postage
-- collected in Bucks cannot disappear from the books.

CREATE TABLE IF NOT EXISTS public.reswell_bucks_accounts (
  code text PRIMARY KEY,
  name text NOT NULL,
  normal_balance text NOT NULL CHECK (normal_balance IN ('debit', 'credit')),
  kind text NOT NULL CHECK (kind IN ('user_liability', 'revenue', 'expense', 'liability', 'bridge'))
);

INSERT INTO public.reswell_bucks_accounts (code, name, normal_balance, kind)
VALUES
  ('buyer_available', 'Buyer spendable Bucks', 'credit', 'user_liability'),
  ('seller_pending', 'Seller pending earnings', 'credit', 'user_liability'),
  ('platform_fee', 'Marketplace fee', 'credit', 'revenue'),
  ('shipping_clearing', 'Shipping collected, not yet matched to a label', 'credit', 'liability'),
  ('promo_subsidy', 'Promo funded by Reswell', 'debit', 'expense'),
  ('shipping_variance', 'Label cost above Bucks collected for shipping', 'debit', 'expense'),
  ('platform_cash_bridge', 'Carrier postage paid in US dollars outside Bucks', 'credit', 'bridge')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.reswell_bucks_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders (id),
  idempotency_key uuid NOT NULL UNIQUE,
  buyer_id uuid NOT NULL REFERENCES auth.users (id),
  seller_id uuid NOT NULL REFERENCES auth.users (id),
  amount_cents bigint NOT NULL CHECK (amount_cents >= 0),
  shipping_cents bigint NOT NULL CHECK (shipping_cents >= 0),
  platform_fee_cents bigint NOT NULL CHECK (platform_fee_cents >= 0),
  seller_earnings_cents bigint NOT NULL CHECK (seller_earnings_cents > 0),
  promo_discount_cents bigint NOT NULL CHECK (promo_discount_cents >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reswell_bucks_settlements_balanced CHECK (
    amount_cents + promo_discount_cents
      = seller_earnings_cents + platform_fee_cents + shipping_cents
  )
);

COMMENT ON TABLE public.reswell_bucks_settlements IS
  'One internal-currency checkout. Header amounts must balance before any wallet row changes.';

CREATE INDEX IF NOT EXISTS reswell_bucks_settlements_buyer_idx
  ON public.reswell_bucks_settlements (buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reswell_bucks_settlements_seller_idx
  ON public.reswell_bucks_settlements (seller_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.reswell_bucks_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id uuid NOT NULL REFERENCES public.reswell_bucks_settlements (id),
  account_code text NOT NULL REFERENCES public.reswell_bucks_accounts (code),
  direction text NOT NULL CHECK (direction IN ('debit', 'credit')),
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  wallet_id uuid REFERENCES public.wallets (id),
  wallet_transaction_id uuid REFERENCES public.wallet_transactions (id),
  user_id uuid,
  source_key text,
  memo text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reswell_bucks_entries_source_key_uidx UNIQUE (source_key),
  CONSTRAINT reswell_bucks_entries_wallet_link_check CHECK (
    (
      account_code IN ('buyer_available', 'seller_pending')
      AND wallet_id IS NOT NULL
      AND wallet_transaction_id IS NOT NULL
    )
    OR (
      account_code NOT IN ('buyer_available', 'seller_pending')
      AND wallet_id IS NULL
      AND wallet_transaction_id IS NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS reswell_bucks_entries_settlement_idx
  ON public.reswell_bucks_entries (settlement_id);
CREATE INDEX IF NOT EXISTS reswell_bucks_entries_account_idx
  ON public.reswell_bucks_entries (account_code);
CREATE INDEX IF NOT EXISTS reswell_bucks_entries_wallet_idx
  ON public.reswell_bucks_entries (wallet_id)
  WHERE wallet_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS reswell_bucks_entries_wallet_tx_idx
  ON public.reswell_bucks_entries (wallet_transaction_id)
  WHERE wallet_transaction_id IS NOT NULL;

COMMENT ON TABLE public.reswell_bucks_entries IS
  'Immutable double-entry legs. User balances point at public.wallets and the wallet_transactions row that moved them. Fee, promo, and shipping are platform accounts, not user wallets.';

CREATE OR REPLACE FUNCTION public.reswell_bucks_entry_matches_wallet()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  r_tx public.wallet_transactions%ROWTYPE;
  v_balance numeric(12, 2);
BEGIN
  IF NEW.account_code NOT IN ('buyer_available', 'seller_pending') THEN
    RETURN NEW;
  END IF;

  SELECT *
  INTO r_tx
  FROM public.wallet_transactions
  WHERE id = NEW.wallet_transaction_id;

  IF NOT FOUND OR r_tx.wallet_id IS DISTINCT FROM NEW.wallet_id THEN
    RAISE EXCEPTION 'wallet_balance_mismatch';
  END IF;

  IF round(abs(r_tx.amount)::numeric * 100)::bigint IS DISTINCT FROM NEW.amount_cents THEN
    RAISE EXCEPTION 'wallet_balance_mismatch';
  END IF;

  IF NEW.account_code = 'buyer_available'
    AND (NEW.direction IS DISTINCT FROM 'debit' OR r_tx.amount >= 0 OR r_tx.reference_type IS DISTINCT FROM 'reswell_bucks_checkout')
  THEN
    RAISE EXCEPTION 'wallet_balance_mismatch';
  END IF;

  IF NEW.account_code = 'seller_pending'
    AND (NEW.direction IS DISTINCT FROM 'credit' OR r_tx.amount <= 0 OR r_tx.reference_type IS DISTINCT FROM 'order_pending_earnings')
  THEN
    RAISE EXCEPTION 'wallet_balance_mismatch';
  END IF;

  -- Buyer spend is a change to wallets.balance. The transaction snapshot must be that row.
  IF NEW.account_code = 'buyer_available' THEN
    SELECT w.balance
    INTO v_balance
    FROM public.wallets w
    WHERE w.id = NEW.wallet_id;

    IF round(COALESCE(v_balance, 0)::numeric, 2) IS DISTINCT FROM round(COALESCE(r_tx.balance_after, 0)::numeric, 2) THEN
      RAISE EXCEPTION 'wallet_balance_mismatch';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reswell_bucks_entries_match_wallet ON public.reswell_bucks_entries;
CREATE TRIGGER reswell_bucks_entries_match_wallet
  BEFORE INSERT ON public.reswell_bucks_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.reswell_bucks_entry_matches_wallet();

ALTER TABLE public.reswell_bucks_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reswell_bucks_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reswell_bucks_entries ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.reswell_bucks_accounts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.reswell_bucks_settlements FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.reswell_bucks_entries FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reswell_bucks_accounts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reswell_bucks_settlements TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reswell_bucks_entries TO service_role;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'wallet_transactions_reference_type_check'
      AND conrelid = 'public.wallet_transactions'::regclass
  ) THEN
    ALTER TABLE public.wallet_transactions
      DROP CONSTRAINT wallet_transactions_reference_type_check;
  END IF;

  ALTER TABLE public.wallet_transactions
    ADD CONSTRAINT wallet_transactions_reference_type_check
    CHECK (
      reference_type IS NULL
      OR reference_type IN (
        'listing',
        'order_pending_earnings',
        'order_seller_earnings',
        'stripe_refund',
        'wallet_refund',
        'stripe_connect_transfer',
        'paypal_payout',
        'shipping_fee_correction',
        'consignment_order_pending_consignor',
        'consignment_order_pending_shop',
        'consignment_order_consignor_earnings',
        'consignment_order_shop_commission',
        'consignment_order_refund_consignor',
        'consignment_order_refund_shop',
        'seller_shipping_label',
        'seller_flat_shipping_surplus',
        'admin_terminal_cash_wallet_correction',
        'board_buy_payout',
        'order_item_return_refund',
        'protection_repair_credit',
        'shipengine_label_adjustment',
        'shipengine_label_adjustment_reversal',
        'reswell_bucks_checkout'
      )
    );
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS wallet_tx_reswell_bucks_checkout_uidx
  ON public.wallet_transactions (reference_type, reference_id)
  WHERE reference_type = 'reswell_bucks_checkout';

CREATE OR REPLACE FUNCTION public.admin_settle_reswell_bucks_checkout(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key uuid;
  v_buyer_id uuid;
  v_seller_id uuid;
  v_amount_cents bigint;
  v_shipping_cents bigint;
  v_fee_cents bigint;
  v_earnings_cents bigint;
  v_promo_cents bigint;
  v_line jsonb;
  v_lines jsonb;
  v_listing_id uuid;
  v_ids uuid[] := ARRAY[]::uuid[];
  v_qty integer;
  v_line_item_cents bigint;
  v_line_ship_cents bigint;
  v_line_fee_cents bigint;
  v_line_earn_cents bigint;
  v_sum_ship bigint := 0;
  v_sum_fee bigint := 0;
  v_sum_earn bigint := 0;
  v_primary uuid;
  v_fulfillment text;
  v_delivery text;
  v_pickup_code text;
  v_packaging text;
  v_address jsonb;
  v_title text;
  v_promo_code_id uuid;
  v_admin_promo_id uuid;
  v_order_id uuid;
  v_order_num text;
  v_settlement_id uuid;
  v_amount_usd numeric(12, 2);
  v_earn_usd numeric(12, 2);
  v_fee_usd numeric(12, 2);
  v_ship_usd numeric(12, 2);
  v_promo_usd numeric(12, 2);
  v_buyer public.wallets%ROWTYPE;
  v_seller public.wallets%ROWTYPE;
  v_buyer_after numeric(12, 2);
  v_seller_pending numeric(12, 2);
  v_seller_available numeric(12, 2);
  v_net bigint;
  v_existing uuid;
  v_debits bigint;
  v_credits bigint;
  v_seller_missing boolean := true;
  v_buyer_tx_id uuid;
  v_seller_tx_id uuid;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'invalid_payload';
  END IF;

  v_key := (p_payload ->> 'idempotency_key')::uuid;
  v_buyer_id := (p_payload ->> 'buyer_id')::uuid;
  v_seller_id := (p_payload ->> 'seller_id')::uuid;
  v_amount_cents := (p_payload ->> 'amount_cents')::bigint;
  v_shipping_cents := (p_payload ->> 'shipping_cents')::bigint;
  v_fee_cents := (p_payload ->> 'platform_fee_cents')::bigint;
  v_earnings_cents := (p_payload ->> 'seller_earnings_cents')::bigint;
  v_promo_cents := (p_payload ->> 'promo_discount_cents')::bigint;

  IF v_key IS NULL OR v_buyer_id IS NULL OR v_seller_id IS NULL THEN
    RAISE EXCEPTION 'invalid_payload';
  END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM v_buyer_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF v_buyer_id = v_seller_id THEN
    RAISE EXCEPTION 'own_listing';
  END IF;
  IF v_amount_cents IS NULL OR v_amount_cents < 0
    OR v_shipping_cents IS NULL OR v_shipping_cents < 0
    OR v_fee_cents IS NULL OR v_fee_cents < 0
    OR v_earnings_cents IS NULL OR v_earnings_cents <= 0
    OR v_promo_cents IS NULL OR v_promo_cents < 0
  THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;
  IF v_amount_cents + v_promo_cents <> v_earnings_cents + v_fee_cents + v_shipping_cents THEN
    RAISE EXCEPTION 'unbalanced_settlement';
  END IF;

  SELECT s.order_id
  INTO v_existing
  FROM public.reswell_bucks_settlements s
  WHERE s.idempotency_key = v_key;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('order_id', v_existing, 'replayed', true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_buyer_id AND p.is_admin IS TRUE
  ) THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  v_lines := p_payload -> 'lines';
  IF jsonb_typeof(v_lines) <> 'array'
    OR jsonb_array_length(v_lines) < 1
    OR jsonb_array_length(v_lines) > 20
  THEN
    RAISE EXCEPTION 'invalid_payload';
  END IF;

  FOR v_line IN SELECT value FROM jsonb_array_elements(v_lines) LOOP
    v_listing_id := (v_line ->> 'listing_id')::uuid;
    v_qty := (v_line ->> 'quantity')::integer;
    v_line_item_cents := (v_line ->> 'item_price_cents')::bigint;
    v_line_ship_cents := (v_line ->> 'shipping_cents')::bigint;
    v_line_fee_cents := (v_line ->> 'platform_fee_cents')::bigint;
    v_line_earn_cents := (v_line ->> 'seller_earnings_cents')::bigint;
    IF v_listing_id IS NULL OR v_qty IS DISTINCT FROM 1 THEN
      RAISE EXCEPTION 'invalid_payload';
    END IF;
    IF v_line_item_cents IS NULL OR v_line_item_cents < 0
      OR v_line_ship_cents IS NULL OR v_line_ship_cents < 0
      OR v_line_fee_cents IS NULL OR v_line_fee_cents < 0
      OR v_line_earn_cents IS NULL OR v_line_earn_cents < 0
      OR v_line_item_cents <> v_line_fee_cents + v_line_earn_cents
    THEN
      RAISE EXCEPTION 'unbalanced_line';
    END IF;
    IF v_listing_id = ANY (v_ids) THEN
      RAISE EXCEPTION 'invalid_payload';
    END IF;
    v_ids := v_ids || v_listing_id;
    v_sum_ship := v_sum_ship + v_line_ship_cents;
    v_sum_fee := v_sum_fee + v_line_fee_cents;
    v_sum_earn := v_sum_earn + v_line_earn_cents;
  END LOOP;

  IF v_sum_ship <> v_shipping_cents OR v_sum_fee <> v_fee_cents OR v_sum_earn <> v_earnings_cents THEN
    RAISE EXCEPTION 'unbalanced_settlement';
  END IF;

  v_primary := v_ids[1];
  v_fulfillment := p_payload ->> 'fulfillment_method';
  v_delivery := p_payload ->> 'delivery_status';
  v_pickup_code := NULLIF(p_payload ->> 'pickup_code', '');
  v_packaging := NULLIF(p_payload ->> 'shipping_packaging_mode', '');
  v_title := left(coalesce(NULLIF(btrim(p_payload ->> 'title_summary'), ''), 'Item'), 180);
  v_promo_code_id := NULLIF(p_payload ->> 'promo_code_id', '')::uuid;
  v_admin_promo_id := NULLIF(p_payload ->> 'admin_promo_code_id', '')::uuid;

  IF v_fulfillment NOT IN ('pickup', 'shipping') THEN
    RAISE EXCEPTION 'invalid_payload';
  END IF;
  IF v_fulfillment = 'pickup' THEN
    IF v_delivery IS DISTINCT FROM 'pickup_ready' OR v_pickup_code IS NULL OR v_packaging IS NOT NULL THEN
      RAISE EXCEPTION 'invalid_payload';
    END IF;
    v_address := NULL;
  ELSE
    IF v_delivery IS DISTINCT FROM 'pending' OR v_pickup_code IS NOT NULL THEN
      RAISE EXCEPTION 'invalid_payload';
    END IF;
    IF v_packaging IS NOT NULL AND v_packaging NOT IN ('together', 'separate') THEN
      RAISE EXCEPTION 'invalid_payload';
    END IF;
    IF cardinality(v_ids) < 2 THEN
      v_packaging := NULL;
    END IF;
    v_address := p_payload -> 'shipping_address';
    IF v_address IS NULL OR jsonb_typeof(v_address) <> 'object' THEN
      RAISE EXCEPTION 'invalid_payload';
    END IF;
  END IF;

  FOR v_listing_id IN
    SELECT l.id
    FROM public.listings l
    WHERE l.id = ANY (v_ids)
    ORDER BY l.id
    FOR UPDATE
  LOOP
    NULL;
  END LOOP;

  IF (
    SELECT count(*)
    FROM public.listings l
    WHERE l.id = ANY (v_ids)
      AND l.user_id = v_seller_id
      AND l.status IN ('active', 'pending_sale')
      AND COALESCE(l.hidden_from_site, false) = false
      AND l.archived_at IS NULL
  ) <> cardinality(v_ids) THEN
    RAISE EXCEPTION 'listing_unavailable';
  END IF;

  v_amount_usd := round(v_amount_cents::numeric / 100, 2);
  v_earn_usd := round(v_earnings_cents::numeric / 100, 2);
  v_fee_usd := round(v_fee_cents::numeric / 100, 2);
  v_ship_usd := round(v_shipping_cents::numeric / 100, 2);
  v_promo_usd := round(v_promo_cents::numeric / 100, 2);

  IF v_buyer_id < v_seller_id THEN
    IF v_amount_cents > 0 THEN
      SELECT * INTO v_buyer
      FROM public.wallets w
      WHERE w.user_id = v_buyer_id
      ORDER BY w.id
      LIMIT 1
      FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'insufficient_balance:0';
      END IF;
    END IF;
    SELECT * INTO v_seller
    FROM public.wallets w
    WHERE w.user_id = v_seller_id
    ORDER BY w.id
    LIMIT 1
    FOR UPDATE;
    v_seller_missing := NOT FOUND;
  ELSE
    SELECT * INTO v_seller
    FROM public.wallets w
    WHERE w.user_id = v_seller_id
    ORDER BY w.id
    LIMIT 1
    FOR UPDATE;
    v_seller_missing := NOT FOUND;
    IF v_amount_cents > 0 THEN
      SELECT * INTO v_buyer
      FROM public.wallets w
      WHERE w.user_id = v_buyer_id
      ORDER BY w.id
      LIMIT 1
      FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'insufficient_balance:0';
      END IF;
    END IF;
  END IF;

  IF v_seller_missing THEN
    INSERT INTO public.wallets (user_id) VALUES (v_seller_id);
    SELECT * INTO v_seller
    FROM public.wallets w
    WHERE w.user_id = v_seller_id
    ORDER BY w.id
    LIMIT 1
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'invalid_payload';
    END IF;
  END IF;

  IF v_amount_cents > 0 THEN
    IF round(COALESCE(v_buyer.balance, 0)::numeric, 2) < v_amount_usd THEN
      RAISE EXCEPTION 'insufficient_balance:%',
        GREATEST(0, round(COALESCE(v_buyer.balance, 0)::numeric * 100))::bigint;
    END IF;
    v_buyer_after := round(COALESCE(v_buyer.balance, 0)::numeric - v_amount_usd, 2);
    UPDATE public.wallets w
    SET
      balance = v_buyer_after,
      lifetime_spent = round(COALESCE(w.lifetime_spent, 0)::numeric + v_amount_usd, 2),
      updated_at = now()
    WHERE w.id = v_buyer.id;
  ELSE
    v_buyer_after := NULL;
  END IF;

  v_seller_pending := round(COALESCE(v_seller.pending_balance, 0)::numeric + v_earn_usd, 2);
  v_seller_available := round(COALESCE(v_seller.balance, 0)::numeric, 2);
  UPDATE public.wallets w
  SET
    pending_balance = v_seller_pending,
    lifetime_earned = round(COALESCE(w.lifetime_earned, 0)::numeric + v_earn_usd, 2),
    updated_at = now()
  WHERE w.id = v_seller.id;

  INSERT INTO public.orders (
    listing_id,
    buyer_id,
    seller_id,
    amount,
    shipping_amount,
    platform_fee,
    seller_earnings,
    promo_code_id,
    admin_promo_code_id,
    promo_discount_usd,
    status,
    payment_method,
    fulfillment_method,
    delivery_status,
    pickup_code,
    sales_channel,
    shipping_packaging_mode,
    shipping_address
  )
  VALUES (
    v_primary,
    v_buyer_id,
    v_seller_id,
    v_amount_usd,
    v_ship_usd,
    v_fee_usd,
    v_earn_usd,
    v_promo_code_id,
    v_admin_promo_id,
    v_promo_usd,
    'confirmed',
    'reswell_bucks',
    v_fulfillment,
    v_delivery,
    v_pickup_code,
    'online',
    v_packaging,
    v_address
  )
  RETURNING id, order_num INTO v_order_id, v_order_num;

  INSERT INTO public.order_items (
    order_id,
    listing_id,
    sort_order,
    quantity,
    item_price,
    shipping_amount,
    platform_fee,
    seller_earnings
  )
  SELECT
    v_order_id,
    (line ->> 'listing_id')::uuid,
    (ordinality - 1)::integer,
    1,
    round(((line ->> 'item_price_cents')::numeric) / 100, 2),
    round(((line ->> 'shipping_cents')::numeric) / 100, 2),
    round(((line ->> 'platform_fee_cents')::numeric) / 100, 2),
    round(((line ->> 'seller_earnings_cents')::numeric) / 100, 2)
  FROM jsonb_array_elements(v_lines) WITH ORDINALITY AS t(line, ordinality);

  INSERT INTO public.reswell_bucks_settlements (
    order_id,
    idempotency_key,
    buyer_id,
    seller_id,
    amount_cents,
    shipping_cents,
    platform_fee_cents,
    seller_earnings_cents,
    promo_discount_cents
  )
  VALUES (
    v_order_id,
    v_key,
    v_buyer_id,
    v_seller_id,
    v_amount_cents,
    v_shipping_cents,
    v_fee_cents,
    v_earnings_cents,
    v_promo_cents
  )
  RETURNING id INTO v_settlement_id;

  IF v_amount_cents > 0 THEN
    INSERT INTO public.wallet_transactions (
      wallet_id, user_id, type, amount, balance_after, description, reference_id, reference_type
    ) VALUES (
      v_buyer.id,
      v_buyer_id,
      'purchase',
      -v_amount_usd,
      v_buyer_after,
      format('Purchased "%s" with Reswell Bucks', v_title),
      v_order_id::text,
      'reswell_bucks_checkout'
    )
    RETURNING id INTO v_buyer_tx_id;

    INSERT INTO public.reswell_bucks_entries (
      settlement_id, account_code, direction, amount_cents, wallet_id, wallet_transaction_id, user_id, memo
    ) VALUES (
      v_settlement_id, 'buyer_available', 'debit', v_amount_cents, v_buyer.id, v_buyer_tx_id, v_buyer_id,
      format('Buyer paid order %s', coalesce(v_order_num, v_order_id::text))
    );
  END IF;

  IF v_promo_cents > 0 THEN
    INSERT INTO public.reswell_bucks_entries (
      settlement_id, account_code, direction, amount_cents, memo
    ) VALUES (
      v_settlement_id, 'promo_subsidy', 'debit', v_promo_cents,
      format('Promo subsidy for order %s', coalesce(v_order_num, v_order_id::text))
    );
  END IF;

  INSERT INTO public.wallet_transactions (
    wallet_id, user_id, type, amount, balance_after, description, reference_id, reference_type
  ) VALUES (
    v_seller.id,
    v_seller_id,
    'sale',
    v_earn_usd,
    v_seller_available,
    format(
      'Pending — Sold "%s" (7%% fee: $%s, Reswell Bucks — available after fulfillment hold)',
      v_title,
      trim(to_char(v_fee_usd, 'FM999999990.00'))
    ),
    v_order_id::text,
    'order_pending_earnings'
  )
  RETURNING id INTO v_seller_tx_id;

  INSERT INTO public.reswell_bucks_entries (
    settlement_id, account_code, direction, amount_cents, wallet_id, wallet_transaction_id, user_id, memo
  ) VALUES (
    v_settlement_id, 'seller_pending', 'credit', v_earnings_cents, v_seller.id, v_seller_tx_id, v_seller_id,
    format('Pending earnings for order %s', coalesce(v_order_num, v_order_id::text))
  );

  IF v_fee_cents > 0 THEN
    INSERT INTO public.reswell_bucks_entries (
      settlement_id, account_code, direction, amount_cents, memo
    ) VALUES (
      v_settlement_id, 'platform_fee', 'credit', v_fee_cents,
      format('Marketplace fee for order %s', coalesce(v_order_num, v_order_id::text))
    );
  END IF;

  IF v_shipping_cents > 0 THEN
    INSERT INTO public.reswell_bucks_entries (
      settlement_id, account_code, direction, amount_cents, memo
    ) VALUES (
      v_settlement_id, 'shipping_clearing', 'credit', v_shipping_cents,
      format('Shipping collected for order %s', coalesce(v_order_num, v_order_id::text))
    );
  END IF;

  SELECT
    COALESCE(SUM(CASE WHEN direction = 'debit' THEN amount_cents ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount_cents ELSE 0 END), 0)
  INTO v_debits, v_credits
  FROM public.reswell_bucks_entries
  WHERE settlement_id = v_settlement_id;

  v_net := v_debits - v_credits;
  IF v_net <> 0 OR v_debits <> v_amount_cents + v_promo_cents THEN
    RAISE EXCEPTION 'unbalanced_settlement';
  END IF;

  UPDATE public.listings
  SET
    status = 'sold',
    sold_off_platform = false,
    sold_off_platform_channel = NULL,
    sold_off_platform_detail = NULL,
    sold_off_platform_at = NULL,
    sold_reswell_helped_find_buyer = NULL,
    updated_at = now()
  WHERE id = ANY (v_ids);

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_num', v_order_num,
    'replayed', false,
    'buyer_balance_after_cents',
      CASE WHEN v_buyer_after IS NULL THEN NULL ELSE round(v_buyer_after * 100)::bigint END
  );
EXCEPTION
  WHEN unique_violation THEN
    SELECT s.order_id INTO v_existing
    FROM public.reswell_bucks_settlements s
    WHERE s.idempotency_key = v_key;
    IF v_existing IS NOT NULL THEN
      RETURN jsonb_build_object('order_id', v_existing, 'replayed', true);
    END IF;
    RAISE;
END;
$$;

COMMENT ON FUNCTION public.admin_settle_reswell_bucks_checkout(jsonb) IS
  'Admin-only atomic Reswell Bucks checkout. Locks listings and wallets, posts a balanced journal, and marks peer listings sold.';

REVOKE ALL ON FUNCTION public.admin_settle_reswell_bucks_checkout(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_settle_reswell_bucks_checkout(jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.post_reswell_bucks_shipping_label_cost(
  p_order_id uuid,
  p_label_id uuid,
  p_cost_cents bigint
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settlement_id uuid;
  v_remaining bigint;
  v_from_clearing bigint;
  v_variance bigint;
  v_source text;
BEGIN
  IF p_order_id IS NULL OR p_label_id IS NULL OR p_cost_cents IS NULL OR p_cost_cents <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  v_source := 'shipping_label:' || p_label_id::text;

  SELECT s.id INTO v_settlement_id
  FROM public.reswell_bucks_settlements s
  WHERE s.order_id = p_order_id;

  IF v_settlement_id IS NULL THEN
    RETURN jsonb_build_object('posted', false, 'reason', 'no_settlement');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.reswell_bucks_entries e WHERE e.source_key = v_source
  ) THEN
    RETURN jsonb_build_object('posted', false, 'reason', 'already_posted');
  END IF;

  SELECT COALESCE(SUM(
    CASE WHEN e.direction = 'credit' THEN e.amount_cents ELSE -e.amount_cents END
  ), 0)
  INTO v_remaining
  FROM public.reswell_bucks_entries e
  WHERE e.settlement_id = v_settlement_id
    AND e.account_code = 'shipping_clearing';

  v_from_clearing := LEAST(p_cost_cents, GREATEST(v_remaining, 0));
  v_variance := p_cost_cents - v_from_clearing;

  IF v_from_clearing > 0 THEN
    INSERT INTO public.reswell_bucks_entries (
      settlement_id, account_code, direction, amount_cents, source_key, memo
    ) VALUES (
      v_settlement_id,
      'shipping_clearing',
      'debit',
      v_from_clearing,
      CASE WHEN v_variance = 0 THEN v_source ELSE NULL END,
      format('Label %s matched to shipping collected', p_label_id)
    );
  END IF;

  IF v_variance > 0 THEN
    INSERT INTO public.reswell_bucks_entries (
      settlement_id, account_code, direction, amount_cents, source_key, memo
    ) VALUES (
      v_settlement_id,
      'shipping_variance',
      'debit',
      v_variance,
      v_source,
      format('Label %s exceeded Bucks collected for shipping', p_label_id)
    );
  END IF;

  INSERT INTO public.reswell_bucks_entries (
    settlement_id, account_code, direction, amount_cents, memo
  ) VALUES (
    v_settlement_id,
    'platform_cash_bridge',
    'credit',
    p_cost_cents,
    format('Carrier postage for label %s', p_label_id)
  );

  RETURN jsonb_build_object(
    'posted', true,
    'clearing_cents', v_from_clearing,
    'variance_cents', v_variance
  );
END;
$$;

COMMENT ON FUNCTION public.post_reswell_bucks_shipping_label_cost(uuid, uuid, bigint) IS
  'Moves Bucks shipping clearing to the cash bridge when a label cost is known. Idempotent per label.';

REVOKE ALL ON FUNCTION public.post_reswell_bucks_shipping_label_cost(uuid, uuid, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_reswell_bucks_shipping_label_cost(uuid, uuid, bigint) TO service_role;

CREATE OR REPLACE FUNCTION public.reswell_bucks_reconcile_summary()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH legs AS (
    SELECT account_code, direction, amount_cents, settlement_id
    FROM public.reswell_bucks_entries
  ),
  settlement_net AS (
    SELECT
      settlement_id,
      SUM(CASE WHEN direction = 'debit' THEN amount_cents ELSE 0 END) AS debits,
      SUM(CASE WHEN direction = 'credit' THEN amount_cents ELSE 0 END) AS credits
    FROM legs
    GROUP BY settlement_id
  ),
  nets AS (
    SELECT
      account_code,
      SUM(CASE WHEN direction = 'credit' THEN amount_cents ELSE -amount_cents END) AS net_cents
    FROM legs
    GROUP BY account_code
  )
  SELECT jsonb_build_object(
    'settlement_count', (SELECT count(*) FROM public.reswell_bucks_settlements),
    'unbalanced_count', (SELECT count(*) FROM settlement_net WHERE debits <> credits),
    'total_debit_cents', (SELECT COALESCE(SUM(amount_cents), 0) FROM legs WHERE direction = 'debit'),
    'total_credit_cents', (SELECT COALESCE(SUM(amount_cents), 0) FROM legs WHERE direction = 'credit'),
    'buyer_spent_cents', (
      SELECT COALESCE(SUM(amount_cents), 0) FROM legs
      WHERE account_code = 'buyer_available' AND direction = 'debit'
    ),
    'seller_pending_cents', (
      SELECT COALESCE(SUM(amount_cents), 0) FROM legs
      WHERE account_code = 'seller_pending' AND direction = 'credit'
    ),
    'wallet_link_drift_count', (
      SELECT count(*)
      FROM public.reswell_bucks_entries e
      LEFT JOIN public.wallet_transactions wt ON wt.id = e.wallet_transaction_id
      LEFT JOIN public.wallets w ON w.id = e.wallet_id
      WHERE e.account_code IN ('buyer_available', 'seller_pending')
        AND (
          wt.id IS NULL
          OR w.id IS NULL
          OR wt.wallet_id IS DISTINCT FROM w.id
          OR round(abs(wt.amount)::numeric * 100)::bigint IS DISTINCT FROM e.amount_cents
        )
    ),
    'buyer_wallets_stored_cents', (
      SELECT COALESCE(SUM(round(w.balance::numeric * 100))::bigint, 0)
      FROM public.wallets w
      WHERE w.id IN (
        SELECT e.wallet_id
        FROM public.reswell_bucks_entries e
        WHERE e.account_code = 'buyer_available'
          AND e.wallet_id IS NOT NULL
      )
    ),
    'seller_wallets_pending_cents', (
      SELECT COALESCE(SUM(round(COALESCE(w.pending_balance, 0)::numeric * 100))::bigint, 0)
      FROM public.wallets w
      WHERE w.id IN (
        SELECT e.wallet_id
        FROM public.reswell_bucks_entries e
        WHERE e.account_code = 'seller_pending'
          AND e.wallet_id IS NOT NULL
      )
    ),
    'platform_fee_cents', COALESCE((SELECT net_cents FROM nets WHERE account_code = 'platform_fee'), 0),
    'shipping_clearing_cents', COALESCE((SELECT net_cents FROM nets WHERE account_code = 'shipping_clearing'), 0),
    'promo_subsidy_cents', COALESCE((SELECT -net_cents FROM nets WHERE account_code = 'promo_subsidy'), 0),
    'shipping_variance_cents', COALESCE((SELECT -net_cents FROM nets WHERE account_code = 'shipping_variance'), 0),
    'carrier_matched_cents', COALESCE((SELECT net_cents FROM nets WHERE account_code = 'platform_cash_bridge'), 0),
    'shipments_awaiting_label_cost', (
      SELECT count(*)
      FROM public.reswell_bucks_settlements s
      WHERE EXISTS (
        SELECT 1 FROM public.reswell_bucks_entries e
        WHERE e.settlement_id = s.id
          AND e.account_code = 'shipping_clearing'
          AND e.direction = 'credit'
      )
      AND (
        SELECT COALESCE(SUM(
          CASE WHEN e.direction = 'credit' THEN e.amount_cents ELSE -e.amount_cents END
        ), 0)
        FROM public.reswell_bucks_entries e
        WHERE e.settlement_id = s.id
          AND e.account_code = 'shipping_clearing'
      ) > 0
    )
  );
$$;

REVOKE ALL ON FUNCTION public.reswell_bucks_reconcile_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reswell_bucks_reconcile_summary() TO service_role;
