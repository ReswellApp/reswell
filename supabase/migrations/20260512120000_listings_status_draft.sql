-- Allow seller draft listings (in-progress create flow) in listings.status.
DO $$
DECLARE
  cname text;
BEGIN
  SELECT con.conname INTO cname
  FROM pg_constraint con
  WHERE con.conrelid = 'public.listings'::regclass
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) LIKE '%status%';

  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.listings DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE public.listings
  ADD CONSTRAINT listings_status_check CHECK (
    status IN (
      'active',
      'sold',
      'pending',
      'removed',
      'pending_sale',
      'draft'
    )
  );

COMMENT ON CONSTRAINT listings_status_check ON public.listings IS
  'Listing lifecycle: draft = seller in-progress (not publicly discoverable).';
