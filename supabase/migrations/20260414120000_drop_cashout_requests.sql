-- Legacy bank / manual cashout queue; earnings cash-out uses PayPal + wallet_transactions.

DROP TABLE IF EXISTS public.cashout_requests CASCADE;
