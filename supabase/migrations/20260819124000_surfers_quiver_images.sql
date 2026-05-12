-- Surfer quiver gallery (board photos on profile).

ALTER TABLE public.surfers
ADD COLUMN IF NOT EXISTS quiver_image_urls text[] NOT NULL DEFAULT '{}';
