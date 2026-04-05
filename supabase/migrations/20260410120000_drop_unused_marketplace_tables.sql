-- Remove unused product surfaces (tables are empty; code paths retired).
-- Order: children first, then parents. CASCADE drops dependent policies and FKs.

-- Offers
DROP TABLE IF EXISTS public.offer_messages CASCADE;
DROP TABLE IF EXISTS public.offers CASCADE;
DROP TABLE IF EXISTS public.offer_settings CASCADE;

-- Purchase protection (claims UI / eligibility tracking)
DROP TABLE IF EXISTS public.purchase_protection_claims CASCADE;
DROP TABLE IF EXISTS public.protection_eligibility CASCADE;

-- Curated surfboard collections (editorial)
DROP TABLE IF EXISTS public.surf_collection_boards CASCADE;
DROP TABLE IF EXISTS public.surf_collections CASCADE;

-- Legacy Stripe Connect / bank payout plumbing (earnings use wallets + PayPal)
DROP TABLE IF EXISTS public.seller_payment_methods CASCADE;
DROP TABLE IF EXISTS public.seller_balances CASCADE;
DROP TABLE IF EXISTS public.seller_stripe_accounts CASCADE;
