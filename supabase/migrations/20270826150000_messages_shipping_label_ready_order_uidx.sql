-- Checkout finalize + Stripe webhook both call purchaseReswellShippingLabelAfterCheckout
-- for the same PaymentIntent. Label purchase is locked; the thread notice was check-then-insert
-- and could be posted twice. Keep the first message per order, then enforce uniqueness.

DELETE FROM public.messages a
USING public.messages b
WHERE (a.metadata->>'kind') = 'shipping_label_ready'
  AND (b.metadata->>'kind') = 'shipping_label_ready'
  AND NULLIF(b.metadata->>'orderId', '') IS NOT NULL
  AND a.metadata->>'orderId' = b.metadata->>'orderId'
  AND (
    a.created_at > b.created_at
    OR (a.created_at = b.created_at AND a.id > b.id)
  );

CREATE UNIQUE INDEX IF NOT EXISTS messages_shipping_label_ready_order_uidx
  ON public.messages ((metadata->>'orderId'))
  WHERE (metadata->>'kind') = 'shipping_label_ready'
    AND NULLIF(metadata->>'orderId', '') IS NOT NULL;

COMMENT ON INDEX public.messages_shipping_label_ready_order_uidx IS
  'At most one shipping_label_ready thread message per order (finalize + webhook overlap).';
