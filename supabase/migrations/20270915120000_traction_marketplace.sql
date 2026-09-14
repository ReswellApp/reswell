-- Traction peer marketplace section (tail pads, front pads, deck grip).

BEGIN;

ALTER TABLE public.listings
  DROP CONSTRAINT IF EXISTS listings_section_check;

ALTER TABLE public.listings
  ADD CONSTRAINT listings_section_check CHECK (
    section IN (
      'new',
      'surfboards',
      'fins',
      'wetsuits',
      'boardbags',
      'surfpacks',
      'leashes',
      'apparel',
      'accessories',
      'magazines',
      'traction'
    )
  );

INSERT INTO public.categories (id, name, slug, description, board) VALUES
  (
    'f1115a1e-aaaa-4bbb-8ccc-000000000009',
    'Traction',
    'used-traction',
    'Used and pre-owned surf traction pads listed by surfers.',
    false
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  board = EXCLUDED.board;

ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS traction_size text;

COMMENT ON COLUMN public.listings.traction_size IS
  'Traction type slug for section=traction listings (tail_pad | front_pad | deck_pad | kit | other). Null for other sections.';

CREATE INDEX IF NOT EXISTS listings_traction_section_created_idx
  ON public.listings (created_at DESC)
  WHERE section = 'traction';

CREATE INDEX IF NOT EXISTS listings_traction_size_idx
  ON public.listings (traction_size)
  WHERE section = 'traction' AND traction_size IS NOT NULL;

COMMIT;
