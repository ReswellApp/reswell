-- Add SEO-friendly slug column to listings
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS slug TEXT;

-- Unique constraint so slugs are never duplicated
CREATE UNIQUE INDEX IF NOT EXISTS listings_slug_unique
  ON public.listings (slug)
  WHERE slug IS NOT NULL;

-- Backfill existing rows: derive slug from title, append -2/-3/… for duplicates
WITH base AS (
  SELECT
    id,
    SUBSTRING(
      LOWER(TRIM(BOTH '-' FROM
        REGEXP_REPLACE(
          REGEXP_REPLACE(
            REGEXP_REPLACE(LOWER(title), '[''ʼ'']', '', 'g'),
            '[^a-z0-9]+', '-', 'g'
          ),
          '-+', '-', 'g'
        )
      ))
    FROM 1 FOR 120) AS base_slug,
    ROW_NUMBER() OVER (
      PARTITION BY
        SUBSTRING(
          LOWER(TRIM(BOTH '-' FROM
            REGEXP_REPLACE(
              REGEXP_REPLACE(
                REGEXP_REPLACE(LOWER(title), '[''ʼ'']', '', 'g'),
                '[^a-z0-9]+', '-', 'g'
              ),
              '-+', '-', 'g'
            )
          ))
        FROM 1 FOR 120)
      ORDER BY created_at
    ) AS rn
  FROM public.listings
  WHERE slug IS NULL
)
UPDATE public.listings l
SET slug = CASE WHEN b.rn = 1 THEN b.base_slug ELSE b.base_slug || '-' || b.rn END
FROM base b
WHERE l.id = b.id;
