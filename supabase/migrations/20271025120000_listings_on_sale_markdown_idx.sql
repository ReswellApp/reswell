-- Speeds `/sale`: active, visible listings whose public markdown is still set.
-- `listings_clear_stale_compare_at_price` nulls compare_at_price unless it is
-- strictly above price, so this partial index is the on-sale set.
CREATE INDEX IF NOT EXISTS listings_on_sale_markdown_idx
  ON public.listings (updated_at DESC, id DESC)
  WHERE status = 'active'
    AND hidden_from_site = false
    AND archived_at IS NULL
    AND compare_at_price IS NOT NULL;
