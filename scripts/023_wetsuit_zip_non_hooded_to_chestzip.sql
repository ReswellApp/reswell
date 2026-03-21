-- Rename legacy zip type value (run after 022)
UPDATE public.listings
SET wetsuit_zip_type = 'chestzip'
WHERE wetsuit_zip_type = 'non_hooded';

COMMENT ON COLUMN public.listings.wetsuit_zip_type IS
  'For wetsuits: hooded | chestzip | backzip';
