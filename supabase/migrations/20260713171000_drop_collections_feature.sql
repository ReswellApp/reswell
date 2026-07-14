-- Retire /collections: drop legacy curated-collection tables and purge SEO redirects.

DROP TABLE IF EXISTS public.surf_collection_boards CASCADE;
DROP TABLE IF EXISTS public.surf_collections CASCADE;
DROP TABLE IF EXISTS public.collection_spot_requests CASCADE;

DELETE FROM public.seo_redirects
WHERE from_path LIKE '/collections%'
   OR to_path LIKE '/collections%';
