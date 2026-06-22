-- Fin catalog models on fin-tagged brands should carry product_category_slug = 'fins'.
UPDATE public.brand_models bm
SET product_category_slug = 'fins'
FROM public.brand_product_categories bpc
WHERE bpc.brand_id = bm.brand_id
  AND bpc.category_slug = 'fins'
  AND bm.product_category_slug = 'surfboards';
