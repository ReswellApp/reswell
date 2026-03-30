-- Follow Seller System
-- Adds: seller_follows table, follow_count cache on profiles,
--       follow notification types, triggers for count accuracy.

-- ─────────────────────────────────────────────────────────────────────────────
-- seller_follows
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.seller_follows (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  seller_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT seller_follows_no_self_follow CHECK (follower_id <> seller_id),
  CONSTRAINT seller_follows_unique UNIQUE (follower_id, seller_id)
);

CREATE INDEX IF NOT EXISTS idx_seller_follows_follower ON public.seller_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_seller_follows_seller   ON public.seller_follows(seller_id);

ALTER TABLE public.seller_follows ENABLE ROW LEVEL SECURITY;

-- Follower sees their own follows; seller sees who follows them (for stats only)
DROP POLICY IF EXISTS "follows_select_own" ON public.seller_follows;
CREATE POLICY "follows_select_own" ON public.seller_follows
  FOR SELECT USING (auth.uid() = follower_id OR auth.uid() = seller_id);

DROP POLICY IF EXISTS "follows_insert_own" ON public.seller_follows;
CREATE POLICY "follows_insert_own" ON public.seller_follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

DROP POLICY IF EXISTS "follows_delete_own" ON public.seller_follows;
CREATE POLICY "follows_delete_own" ON public.seller_follows
  FOR DELETE USING (auth.uid() = follower_id);

-- Service role can read all (for notification fan-out)
DROP POLICY IF EXISTS "follows_service_select" ON public.seller_follows;
CREATE POLICY "follows_service_select" ON public.seller_follows
  FOR SELECT USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- Cached follower_count column on profiles (avoid COUNT(*) on every page load)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS follower_count INTEGER NOT NULL DEFAULT 0;

-- ─────────────────────────────────────────────────────────────────────────────
-- Triggers: increment / decrement follower_count on follow / unfollow
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.increment_follower_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles SET follower_count = follower_count + 1 WHERE id = NEW.seller_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_follow_created ON public.seller_follows;
CREATE TRIGGER on_follow_created
  AFTER INSERT ON public.seller_follows
  FOR EACH ROW EXECUTE FUNCTION public.increment_follower_count();

CREATE OR REPLACE FUNCTION public.decrement_follower_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles SET follower_count = GREATEST(0, follower_count - 1) WHERE id = OLD.seller_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_follow_deleted ON public.seller_follows;
CREATE TRIGGER on_follow_deleted
  AFTER DELETE ON public.seller_follows
  FOR EACH ROW EXECUTE FUNCTION public.decrement_follower_count();

-- ─────────────────────────────────────────────────────────────────────────────
-- Extend notifications.type CHECK to include follow event types
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'listing_saved',
    'offer_received',
    'offer_countered',
    'offer_accepted',
    'offer_declined',
    'offer_withdrawn',
    'offer_expired',
    'offer_expiring_soon',
    'new_listing_from_followed',
    'price_drop_from_followed'
  ));

-- Fast unread follow notification queries (for the bell badge)
CREATE INDEX IF NOT EXISTS idx_notifications_follow_unread
  ON public.notifications(user_id, is_read, created_at DESC)
  WHERE type IN ('new_listing_from_followed', 'price_drop_from_followed');

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC helpers
-- ─────────────────────────────────────────────────────────────────────────────

-- Fast follower-count lookup (reads cached column — no COUNT)
CREATE OR REPLACE FUNCTION public.get_seller_follower_count(p_seller_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(follower_count, 0) FROM public.profiles WHERE id = p_seller_id;
$$;
GRANT EXECUTE ON FUNCTION public.get_seller_follower_count(uuid) TO authenticated, anon, service_role;

-- Seed follower_count from actual rows (run once after migration)
CREATE OR REPLACE FUNCTION public.reseed_follower_counts()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles p
  SET follower_count = (
    SELECT COUNT(*) FROM public.seller_follows sf WHERE sf.seller_id = p.id
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.reseed_follower_counts() TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- notification_preferences table (per-user follow notification toggles)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  follow_in_app         BOOLEAN NOT NULL DEFAULT TRUE,
  follow_email_digest   BOOLEAN NOT NULL DEFAULT TRUE,
  digest_time           TEXT NOT NULL DEFAULT 'morning' CHECK (digest_time IN ('morning', 'evening')),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT notification_prefs_unique_user UNIQUE (user_id)
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notif_prefs_select_own" ON public.notification_preferences;
CREATE POLICY "notif_prefs_select_own" ON public.notification_preferences
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notif_prefs_upsert_own" ON public.notification_preferences;
CREATE POLICY "notif_prefs_upsert_own" ON public.notification_preferences
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
