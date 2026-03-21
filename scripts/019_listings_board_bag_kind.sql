-- Day vs travel board bags — used with /used/board-bags filters
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS board_bag_kind TEXT;

COMMENT ON COLUMN public.listings.board_bag_kind IS 'For used board-bag category: day | travel';
