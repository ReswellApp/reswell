-- Lost Surfboards by Mayhem: "lost" and "mayhem" are the same brand.
-- Runtime also applies this as a built-in synonym; this row makes it visible
-- and editable in admin search curation.

INSERT INTO public.search_synonyms (term, expansions, enabled)
SELECT 'lost', ARRAY['mayhem']::text[], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.search_synonyms WHERE lower(term) = 'lost'
);

INSERT INTO public.search_synonyms (term, expansions, enabled)
SELECT 'mayhem', ARRAY['lost']::text[], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.search_synonyms WHERE lower(term) = 'mayhem'
);

UPDATE public.search_synonyms
SET
  expansions = ARRAY(
    SELECT DISTINCT e
    FROM unnest(expansions || ARRAY['mayhem']) AS e
  ),
  enabled = true,
  updated_at = now()
WHERE lower(term) = 'lost'
  AND NOT EXISTS (
    SELECT 1
    FROM unnest(expansions) AS e
    WHERE lower(e) = 'mayhem'
  );

UPDATE public.search_synonyms
SET
  expansions = ARRAY(
    SELECT DISTINCT e
    FROM unnest(expansions || ARRAY['lost']) AS e
  ),
  enabled = true,
  updated_at = now()
WHERE lower(term) = 'mayhem'
  AND NOT EXISTS (
    SELECT 1
    FROM unnest(expansions) AS e
    WHERE lower(e) = 'lost'
  );
