-- Restore Hayden Shapes directory facts and a marketplace-ready short description.
UPDATE public.brands
SET
  short_description = 'FutureFlex surfboards from Hayden Cox in Sydney — used Hayden Shapes, from Hypto Krypto to alternative shapes.',
  founder_name = 'Hayden Cox',
  lead_shaper_name = 'Hayden Cox',
  location_label = 'Sydney, Australia',
  updated_at = now()
WHERE slug = 'hayden-shapes';
