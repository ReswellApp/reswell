-- Categories: marketplace flags + drop legacy `section` (see also scripts/001_create_schema.sql for fresh installs).
-- Run in Supabase SQL Editor (or your migration runner).

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS board BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS gear BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.categories
  DROP CONSTRAINT IF EXISTS categories_board_xor_gear;

ALTER TABLE public.categories
  ADD CONSTRAINT categories_board_xor_gear CHECK (NOT (board AND gear));

COMMENT ON COLUMN public.categories.board IS 'Surfboard listing categories (maps to listings.section = surfboards).';
COMMENT ON COLUMN public.categories.gear IS 'Used gear / marketplace gear categories (maps to listings.section = used).';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'categories' AND column_name = 'section'
  ) THEN
    UPDATE public.categories SET board = TRUE, gear = FALSE WHERE section = 'surfboards';
    UPDATE public.categories SET board = FALSE, gear = TRUE WHERE section = 'used';
    -- section = 'new' (retail) rows stay board = FALSE, gear = FALSE
    ALTER TABLE public.categories DROP COLUMN section;
  END IF;
END $$;
