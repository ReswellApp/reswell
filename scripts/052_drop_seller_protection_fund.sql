-- Run once in Supabase SQL Editor (or via supabase db push / migration)
-- Clears advisor warning: "Table public.seller_protection_fund is public, but RLS has not been enabled"
-- Buyer protection is funded from Reswell's 7% fee — these tables are unused.

DROP TABLE IF EXISTS public.seller_protection_contributions CASCADE;
DROP TABLE IF EXISTS public.seller_protection_fund CASCADE;
