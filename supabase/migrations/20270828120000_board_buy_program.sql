-- Reswell buy program: users submit a board, ops quote (or auto 20% off after 30m),
-- seller accepts, prepaid inbound label, payout to wallet after receipt.

CREATE TABLE IF NOT EXISTS public.board_buy_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  title text NOT NULL,
  asking_price numeric(12, 2) NOT NULL,
  offered_price numeric(12, 2),
  quote_source text,
  status text NOT NULL DEFAULT 'submitted',
  sla_deadline_at timestamptz NOT NULL,
  quoted_at timestamptz,
  accepted_at timestamptz,
  declined_at timestamptz,
  received_at timestamptz,
  paid_at timestamptz,
  ops_notes text,
  seller_note text,
  ship_from_name text NOT NULL,
  ship_from_phone text NOT NULL,
  ship_from_line1 text NOT NULL,
  ship_from_line2 text,
  ship_from_city text NOT NULL,
  ship_from_state text NOT NULL,
  ship_from_postal text NOT NULL,
  ship_from_country text NOT NULL DEFAULT 'US',
  parcel_length_in numeric(8, 2),
  parcel_width_in numeric(8, 2),
  parcel_height_in numeric(8, 2),
  parcel_weight_lb numeric(8, 2),
  label_pdf_url text,
  label_id text,
  tracking_number text,
  tracking_carrier text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT board_buy_submissions_title_nonempty CHECK (char_length(trim(title)) > 0),
  CONSTRAINT board_buy_submissions_asking_positive CHECK (asking_price > 0),
  CONSTRAINT board_buy_submissions_offered_positive CHECK (offered_price IS NULL OR offered_price > 0),
  CONSTRAINT board_buy_submissions_quote_source_check CHECK (
    quote_source IS NULL OR quote_source IN ('ops', 'auto_sla')
  ),
  CONSTRAINT board_buy_submissions_status_check CHECK (
    status IN (
      'submitted',
      'quoted',
      'auto_quoted',
      'declined',
      'accepted',
      'label_ready',
      'received',
      'paid',
      'withdrawn'
    )
  )
);

COMMENT ON TABLE public.board_buy_submissions IS
  'Reswell buy-program submissions. Ops quotes within 30 minutes or the system offers 20% off asking.';

CREATE INDEX IF NOT EXISTS board_buy_submissions_user_idx
  ON public.board_buy_submissions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS board_buy_submissions_status_sla_idx
  ON public.board_buy_submissions (status, sla_deadline_at)
  WHERE status = 'submitted';

CREATE INDEX IF NOT EXISTS board_buy_submissions_status_created_idx
  ON public.board_buy_submissions (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.board_buy_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.board_buy_submissions (id) ON DELETE CASCADE,
  url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  CONSTRAINT board_buy_photos_url_nonempty CHECK (char_length(trim(url)) > 0)
);

CREATE INDEX IF NOT EXISTS board_buy_photos_submission_idx
  ON public.board_buy_photos (submission_id, sort_order);

ALTER TABLE public.board_buy_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_buy_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY board_buy_submissions_select_own
  ON public.board_buy_submissions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY board_buy_submissions_insert_own
  ON public.board_buy_submissions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY board_buy_photos_select_own
  ON public.board_buy_photos FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.board_buy_submissions s
      WHERE s.id = submission_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY board_buy_photos_insert_own
  ON public.board_buy_photos FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.board_buy_submissions s
      WHERE s.id = submission_id AND s.user_id = auth.uid()
    )
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'board-buy-photos',
  'board-buy-photos',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "board_buy_photos_insert_own" ON storage.objects;
CREATE POLICY "board_buy_photos_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'board-buy-photos'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

DROP POLICY IF EXISTS "board_buy_photos_select_public" ON storage.objects;
CREATE POLICY "board_buy_photos_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'board-buy-photos');

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
        'board_buy_payout'
      )
    );
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS wallet_tx_board_buy_payout_uidx
  ON public.wallet_transactions (reference_type, reference_id)
  WHERE reference_type = 'board_buy_payout';
