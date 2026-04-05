-- Remove curated collection spot request queue (UI + API retired).

DROP TABLE IF EXISTS public.collection_spot_requests CASCADE;
