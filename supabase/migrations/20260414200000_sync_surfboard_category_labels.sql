-- Align surfboard category labels with current product naming (idempotent, by fixed UUIDs).
-- App code also normalizes display in `lib/surfboard-category-display.ts` for legacy rows.

UPDATE public.categories
SET
  name = 'Groveler',
  slug = 'groveler',
  description = 'Small-wave grovelers and hybrid shapes.'
WHERE id = 'f3ccddc0-f0f3-45d3-ad43-51bcf9935b45';

UPDATE public.categories
SET
  name = 'Hybrid',
  slug = 'hybrid',
  description = 'Hybrid surfboards — between shortboard and longboard.'
WHERE id = '93b8eeaf-366b-4823-8bb9-98d42c5fefba';

UPDATE public.categories
SET
  name = 'Step-Up / Gun',
  slug = 'step-up-gun',
  description = 'Step-ups and guns for heavier waves and bigger surf.'
WHERE id = '91c4e8a2-3f5b-4d1c-9e6a-7b8c9d0e1f2a';

UPDATE public.categories
SET
  name = 'Shortboard',
  slug = 'shortboard',
  description = 'Performance shortboards'
WHERE id = '7e434a96-f3f7-4a73-b733-704a769195e6';

UPDATE public.categories
SET
  name = 'Longboard',
  slug = 'longboard',
  description = 'Classic longboards'
WHERE id = '47a0d0bb-8738-43b4-a0fe-a5b2acc72fa3';
