-- IP + device signals used to stop a phishing scammer from immediately
-- signing up again on the same machine. Service role only.

CREATE TABLE IF NOT EXISTS public.user_access_signals (
  user_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  last_ip_hash text,
  last_device_hash text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.banned_access_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('ip', 'device')),
  signal_hash text NOT NULL,
  source_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  UNIQUE (kind, signal_hash)
);

CREATE INDEX IF NOT EXISTS idx_banned_access_signals_lookup
  ON public.banned_access_signals (kind, signal_hash);

CREATE INDEX IF NOT EXISTS idx_banned_access_signals_expires_at
  ON public.banned_access_signals (expires_at);

COMMENT ON TABLE public.user_access_signals IS
  'Last hashed client IP and device cookie for a user. Written by the message send path so a phishing ban can also ban the machine.';

COMMENT ON TABLE public.banned_access_signals IS
  'Hashed IP / device cookies banned after a new-account phishing spray. Blocks signup and new-account messaging.';

ALTER TABLE public.user_access_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banned_access_signals ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.user_access_signals FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.banned_access_signals FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.user_access_signals TO service_role;
GRANT ALL ON TABLE public.banned_access_signals TO service_role;

NOTIFY pgrst, 'reload schema';
