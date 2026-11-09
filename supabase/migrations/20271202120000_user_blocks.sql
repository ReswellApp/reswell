-- Member-facing user blocks for App Store Guideline 1.2 (UGC moderation).

CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_blocks_pkey PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT user_blocks_no_self CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS user_blocks_blocked_id_idx
  ON public.user_blocks (blocked_id);

CREATE INDEX IF NOT EXISTS user_blocks_blocker_id_created_at_idx
  ON public.user_blocks (blocker_id, created_at DESC);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_blocks_select_own" ON public.user_blocks;
CREATE POLICY "user_blocks_select_own" ON public.user_blocks
  FOR SELECT
  USING (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "user_blocks_insert_own" ON public.user_blocks;
CREATE POLICY "user_blocks_insert_own" ON public.user_blocks
  FOR INSERT
  WITH CHECK (auth.uid() = blocker_id AND auth.uid() <> blocked_id);

DROP POLICY IF EXISTS "user_blocks_delete_own" ON public.user_blocks;
CREATE POLICY "user_blocks_delete_own" ON public.user_blocks
  FOR DELETE
  USING (auth.uid() = blocker_id);

COMMENT ON TABLE public.user_blocks IS
  'Member A blocks member B: hide threads, refuse new messages either direction.';
