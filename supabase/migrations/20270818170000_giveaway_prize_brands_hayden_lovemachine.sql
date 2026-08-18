-- Add Hayden Shapes and Lovemachine to the giveaway prize-brand check.

ALTER TABLE public.giveaway_entries
  DROP CONSTRAINT IF EXISTS giveaway_entries_preferred_brand_check;

ALTER TABLE public.giveaway_entries
  ADD CONSTRAINT giveaway_entries_preferred_brand_check
  CHECK (
    preferred_brand IS NULL
    OR preferred_brand IN (
      'channel-islands',
      'mayhem',
      'js',
      'sharpeye',
      'hayden-shapes',
      'lovemachine'
    )
  );
