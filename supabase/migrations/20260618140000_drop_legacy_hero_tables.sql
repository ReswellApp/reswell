-- Homepage hero: final consolidation on `public.home_hero_listings`.
--
-- This migration retires the two legacy approaches we used before admins picked
-- *listings* (whose primary images feed the hero):
--   1. `public.home_hero_slides`   — original standalone URL table (created in 20260409,
--      dropped in 20260410, restored in 20260501 "just in case"). Not referenced by any
--      application code anymore.
--   2. `public.images` (scope='home_hero') — the 2nd-gen curated URL table that replaced
--      `home_hero_slides`. Also not referenced by any application code anymore.
--
-- Everything the homepage hero needs now lives in `public.home_hero_listings`, created in
-- 20260618130000. That table references real listings (ON DELETE CASCADE), so image URLs
-- stay in sync with listing state automatically and we never end up with orphan slides.
--
-- CASCADE removes dependent policies, indexes, and constraints in one shot. Both drops are
-- guarded by IF EXISTS so this migration is safe to run on environments where one or both
-- tables were already removed (e.g. your live DB where `home_hero_slides` is already gone).

DROP TABLE IF EXISTS public.home_hero_slides CASCADE;
DROP TABLE IF EXISTS public.images CASCADE;
