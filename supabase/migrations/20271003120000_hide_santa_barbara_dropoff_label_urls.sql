-- Santa Barbara drop-off sellers must not receive carrier-label URLs in chat.
-- Admin order pages still read order_shipping_labels / order_admin_shipping_labels.

UPDATE public.messages AS m
SET
  metadata = CASE
    WHEN jsonb_typeof(m.metadata) = 'object' THEN
      jsonb_set(
        jsonb_set(m.metadata, '{labelPdfUrl}', 'null'::jsonb, true),
        '{hasPaperlessQr}',
        'false'::jsonb,
        true
      )
    ELSE m.metadata
  END,
  content = btrim(
    regexp_replace(
      regexp_replace(m.content, 'https?://\S*shipengine\S+', '', 'gi'),
      'label[[:space:]]*\(pdf\)[[:space:]]*:[[:space:]]*\S+',
      '',
      'gi'
    )
  )
WHERE COALESCE(m.metadata->>'orderId', '') IN (
  SELECT o.id::text
  FROM public.orders AS o
  WHERE EXISTS (
    SELECT 1
    FROM public.listings AS l
    JOIN public.dropoff_locations AS d ON d.id = l.dropoff_location_id
    WHERE d.slug = 'santa-barbara'
      AND (
        l.id = o.listing_id
        OR EXISTS (
          SELECT 1
          FROM public.order_items AS oi
          WHERE oi.order_id = o.id
            AND oi.listing_id = l.id
        )
      )
  )
)
AND (
  m.metadata->>'kind' IN ('admin_shipping_label', 'shipping_label_ready')
  OR m.content ~* 'shipping label ready'
);
