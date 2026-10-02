ALTER TABLE public.shipengine_label_adjustments
  ADD COLUMN IF NOT EXISTS admin_alerted_at timestamptz;

COMMENT ON COLUMN public.shipengine_label_adjustments.admin_alerted_at IS
  'When the positive fee adjustment was included in the Klaviyo admin SMS alert event.';

-- The feature alerts only on adjustments created after deployment, not the
-- historical rows already visible in the admin table.
UPDATE public.shipengine_label_adjustments
SET admin_alerted_at = COALESCE(created_at, now())
WHERE adjustment_amount_usd > 0
  AND admin_alerted_at IS NULL;

CREATE INDEX IF NOT EXISTS shipengine_label_adjustments_admin_alert_pending_idx
  ON public.shipengine_label_adjustments (created_at)
  WHERE adjustment_amount_usd > 0
    AND admin_alerted_at IS NULL;
