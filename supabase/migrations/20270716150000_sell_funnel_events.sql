-- Sell funnel instrumentation: one row per notable event in the /sell publish
-- funnel (attempts, validation failures, upload failures, publish outcomes) so
-- drop-off points can be measured instead of guessed.
create table if not exists public.sell_funnel_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null,
  listing_type text not null,
  event text not null,
  field text,
  message text,
  listing_id uuid,
  duration_ms integer
);

create index if not exists sell_funnel_events_event_created_at_idx
  on public.sell_funnel_events (event, created_at desc);

create index if not exists sell_funnel_events_user_id_idx
  on public.sell_funnel_events (user_id);

alter table public.sell_funnel_events enable row level security;

-- Inserts come from the logSellFunnelEventAction server action using the
-- caller's session (guests log with a null user_id). No client reads: analytics
-- queries go through the service role.
create policy "sell_funnel_events_insert_own"
  on public.sell_funnel_events
  for insert
  to anon, authenticated
  with check (user_id is null or user_id = (select auth.uid()));
