-- Add reason code for phone numbers split across consecutive short messages.

ALTER TABLE public.fraud_messages
  DROP CONSTRAINT IF EXISTS fraud_messages_reason_code_check;

ALTER TABLE public.fraud_messages
  ADD CONSTRAINT fraud_messages_reason_code_check
  CHECK (reason_code IN ('phone_like', 'phone_fragment', 'email_like', 'off_platform_payment'));

COMMENT ON COLUMN public.fraud_messages.reason_code IS
  'Why the message was intercepted: phone_like, phone_fragment (number split across messages), email_like, or off_platform_payment (Venmo/PayPal/cash).';
