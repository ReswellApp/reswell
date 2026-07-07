-- Magazines peer marketplace section (admin-listed, shipping-only catalog).

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
      'magazines'
    )
  );

INSERT INTO public.categories (id, name, slug, description, board) VALUES
  (
    'f1115a1e-aaaa-4bbb-8ccc-000000000008',
    'Magazines',
    'used-magazines',
    'Surf magazines and media listed by Reswell.',
    false
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  board = EXCLUDED.board;

ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS magazine_year integer;

COMMENT ON COLUMN public.listings.magazine_year IS
  'Publication year for section=magazines listings. Null for other sections.';

CREATE INDEX IF NOT EXISTS listings_magazines_section_created_idx
  ON public.listings (created_at DESC)
  WHERE section = 'magazines';

CREATE INDEX IF NOT EXISTS listings_magazines_year_idx
  ON public.listings (magazine_year)
  WHERE section = 'magazines' AND magazine_year IS NOT NULL;

COMMIT;
