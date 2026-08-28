ALTER TABLE public.board_buy_submissions
  ADD COLUMN IF NOT EXISTS quote_message text;

COMMENT ON COLUMN public.board_buy_submissions.quote_message IS
  'Seller-visible message from Reswell on the quote page. Separate from internal ops_notes.';
