-- Append surfboard length to listing titles (same rules as lib/listing-title-board-length.ts).
-- Targets surfboard listings with length_feet set. Skips rows whose title already ends with
-- that length (case-insensitive), including " - length" / " – length" suffixes.
--
-- Run in Supabase SQL Editor (or psql). Afterward, re-sync search index if you use Elasticsearch
-- (e.g. trigger your listing sync or full reindex).

WITH src AS (
  SELECT
    id,
    title,
    CASE
      WHEN length_feet IS NOT NULL AND length_inches IS NOT NULL THEN
        length_feet::text || chr(39) || length_inches::text || '"'
      WHEN length_feet IS NOT NULL THEN
        length_feet::text || chr(39)
    END AS board_len
  FROM public.listings
  WHERE section = 'surfboards'
    AND length_feet IS NOT NULL
    AND title IS NOT NULL
)
UPDATE public.listings l
SET
  title = CASE
    WHEN trim(both from l.title) = '' THEN s.board_len
    ELSE trim(both from l.title) || ' - ' || s.board_len
  END,
  updated_at = now()
FROM src s
WHERE l.id = s.id
  AND s.board_len IS NOT NULL
  AND NOT (
    lower(trim(both from l.title)) = lower(s.board_len)
    OR right(lower(trim(both from l.title)), char_length(lower(s.board_len))) = lower(s.board_len)
    OR right(lower(trim(both from l.title)), char_length('- ' || lower(s.board_len))) = '- ' || lower(s.board_len)
    OR right(lower(trim(both from l.title)), char_length('– ' || lower(s.board_len))) = '– ' || lower(s.board_len)
  );
