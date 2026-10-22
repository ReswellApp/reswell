-- Buyer shipping texts and emails are one claim per order per milestone
-- (out for delivery, delivered, exception). Webhook, cron, and a purchase-page
-- refresh all observe the same carrier snapshot; the first insert wins.
-- Snapshot wording can change after delivery ("Delivered" vs "Delivered, Front
-- Door/Porch") without creating another claim.

CREATE TABLE IF NOT EXISTS public.order_shipping_milestone_claims (
  order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,
  milestone text NOT NULL CHECK (milestone IN ('out_for_delivery', 'delivered', 'exception')),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (order_id, milestone)
);

COMMENT ON TABLE public.order_shipping_milestone_claims IS
  'One Order Shipping Update per order per carrier milestone. Insert is the send lock.';

ALTER TABLE public.order_shipping_milestone_claims ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.order_shipping_milestone_claims FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.order_shipping_milestone_claims TO service_role;

-- Orders already past these milestones must not text again on the next page view.
INSERT INTO public.order_shipping_milestone_claims (order_id, milestone)
SELECT o.id, 'delivered'
FROM public.orders o
WHERE o.fulfillment_method = 'shipping'
  AND (
    o.delivery_status = 'delivered'
    OR o.carrier_delivered_at IS NOT NULL
    OR upper(coalesce(o.tracking_detail->>'status_code', '')) = 'DE'
    OR nullif(btrim(coalesce(o.tracking_detail->>'actual_delivery_date', '')), '') IS NOT NULL
  )
ON CONFLICT DO NOTHING;

INSERT INTO public.order_shipping_milestone_claims (order_id, milestone)
SELECT o.id, 'out_for_delivery'
FROM public.orders o
WHERE o.fulfillment_method = 'shipping'
  AND o.delivery_status IS DISTINCT FROM 'delivered'
  AND o.carrier_delivered_at IS NULL
  AND upper(coalesce(o.tracking_detail->>'status_code', '')) IS DISTINCT FROM 'DE'
  AND nullif(btrim(coalesce(o.tracking_detail->>'actual_delivery_date', '')), '') IS NULL
  AND (
    upper(coalesce(o.tracking_detail->>'status_code', '')) = 'OF'
    OR coalesce(o.tracking_detail->>'status_description', '') ~* 'out[[:space:]]+for[[:space:]]+delivery'
    OR coalesce(o.tracking_detail->>'carrier_status_description', '') ~* 'out[[:space:]]+for[[:space:]]+delivery'
    OR coalesce(o.tracking_detail#>>'{events,0,description}', '') ~* 'out[[:space:]]+for[[:space:]]+delivery'
  )
ON CONFLICT DO NOTHING;

INSERT INTO public.order_shipping_milestone_claims (order_id, milestone)
SELECT o.id, 'exception'
FROM public.orders o
WHERE o.fulfillment_method = 'shipping'
  AND o.delivery_status IS DISTINCT FROM 'delivered'
  AND o.carrier_delivered_at IS NULL
  AND upper(coalesce(o.tracking_detail->>'status_code', '')) = 'EX'
  AND nullif(btrim(coalesce(o.tracking_detail->>'actual_delivery_date', '')), '') IS NULL
ON CONFLICT DO NOTHING;
