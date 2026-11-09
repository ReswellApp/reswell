-- Buyer delivered text is a fact on the order, next to carrier_delivered_at.
-- Null means the delivered Order Shipping Update has not been sent.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS buyer_notified_delivered_at timestamptz;

COMMENT ON COLUMN public.orders.buyer_notified_delivered_at IS
  'When the buyer was sent the delivered shipping update. Null means not sent. Set before the Klaviyo send and cleared if that send is not accepted. Historical delivered orders are stamped with carrier_delivered_at so they are not texted again.';

-- Orders already delivered are not new messages. Use the carrier time we have.
UPDATE public.orders
SET buyer_notified_delivered_at = COALESCE(carrier_delivered_at, updated_at, now())
WHERE buyer_notified_delivered_at IS NULL
  AND (
    delivery_status = 'delivered'
    OR carrier_delivered_at IS NOT NULL
  );
