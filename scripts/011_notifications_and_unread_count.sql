-- Notifications (e.g. "Someone saved your item") and unread message count for header badge.
-- When a user saves/likes a listing, the listing owner gets an internal notification shown in Messages.

-- Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'listing_saved' CHECK (type IN ('listing_saved')),
  listing_id UUID REFERENCES public.listings(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  message TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Trigger: when someone adds a favorite, notify the listing owner (unless they favorited their own item)
CREATE OR REPLACE FUNCTION public.notify_listing_owner_on_favorite()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id uuid;
  listing_title text;
BEGIN
  SELECT l.user_id, l.title INTO owner_id, listing_title
  FROM public.listings l WHERE l.id = NEW.listing_id;
  IF owner_id IS NULL OR owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.notifications (user_id, type, listing_id, actor_id, message)
  VALUES (
    owner_id,
    'listing_saved',
    NEW.listing_id,
    NEW.user_id,
    'Someone saved your item: ' || COALESCE(listing_title, 'your listing')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_favorite_created ON public.favorites;
CREATE TRIGGER on_favorite_created
  AFTER INSERT ON public.favorites
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_listing_owner_on_favorite();

-- RPC: unread message count for current user (messages where user is recipient and not sender, unread)
CREATE OR REPLACE FUNCTION public.get_unread_message_count(uid uuid)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::bigint
  FROM public.messages m
  JOIN public.conversations c ON c.id = m.conversation_id
  WHERE (c.buyer_id = uid OR c.seller_id = uid)
    AND m.sender_id <> uid
    AND m.is_read = false;
$$;

GRANT EXECUTE ON FUNCTION public.get_unread_message_count(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_unread_message_count(uuid) TO service_role;

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read) WHERE is_read = false;
