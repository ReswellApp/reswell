-- Allow sell-flow banner analytics on giveaway_events.surface.

ALTER TABLE public.giveaway_events
  DROP CONSTRAINT IF EXISTS giveaway_events_surface_check;

ALTER TABLE public.giveaway_events
  ADD CONSTRAINT giveaway_events_surface_check
  CHECK (surface IN ('homepage', 'popup', 'giveaway_page', 'sell'));
