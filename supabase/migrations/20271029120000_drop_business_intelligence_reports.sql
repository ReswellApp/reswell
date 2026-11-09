-- Retire saved Gemini business-intelligence briefings.
-- The live /admin/intelligence dashboard does not use this table.
-- Deliberately omit CASCADE so this migration fails rather than removing an
-- unexpected dependency introduced outside the feature.

DROP TABLE IF EXISTS public.business_intelligence_reports;
