-- Expo push tokens for the iOS/Android app. One row per device.
-- Preference lives on notification_preferences.push_opt_in (default on).
-- OS permission plus an active token is what actually delivers.

ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS push_opt_in boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.notification_preferences.push_opt_in IS
  'When false, skip Expo push even if this user has an active device token.';

CREATE TABLE IF NOT EXISTS public.device_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  expo_push_token text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('ios', 'android')),
  device_id text NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  disabled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT device_push_tokens_token UNIQUE (expo_push_token),
  CONSTRAINT device_push_tokens_user_device UNIQUE (user_id, device_id),
  CONSTRAINT device_push_tokens_token_length CHECK (char_length(expo_push_token) BETWEEN 16 AND 256),
  CONSTRAINT device_push_tokens_device_id_length CHECK (char_length(device_id) BETWEEN 1 AND 128)
);

COMMENT ON TABLE public.device_push_tokens IS
  'Expo push tokens for Reswell mobile. Service role sends; the owner can register or remove their own rows.';

CREATE INDEX IF NOT EXISTS device_push_tokens_user_active_idx
  ON public.device_push_tokens (user_id)
  WHERE disabled_at IS NULL;

ALTER TABLE public.device_push_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.device_push_tokens FROM PUBLIC;
REVOKE ALL ON TABLE public.device_push_tokens FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.device_push_tokens TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.device_push_tokens TO service_role;

DROP POLICY IF EXISTS device_push_tokens_select_own ON public.device_push_tokens;
CREATE POLICY device_push_tokens_select_own
  ON public.device_push_tokens
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS device_push_tokens_insert_own ON public.device_push_tokens;
CREATE POLICY device_push_tokens_insert_own
  ON public.device_push_tokens
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS device_push_tokens_update_own ON public.device_push_tokens;
CREATE POLICY device_push_tokens_update_own
  ON public.device_push_tokens
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS device_push_tokens_delete_own ON public.device_push_tokens;
CREATE POLICY device_push_tokens_delete_own
  ON public.device_push_tokens
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
