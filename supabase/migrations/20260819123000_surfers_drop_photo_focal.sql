-- Remove photo focal/crop columns (feature reverted).

ALTER TABLE public.surfers DROP COLUMN IF EXISTS photo_focal_x_pct;
ALTER TABLE public.surfers DROP COLUMN IF EXISTS photo_focal_y_pct;
