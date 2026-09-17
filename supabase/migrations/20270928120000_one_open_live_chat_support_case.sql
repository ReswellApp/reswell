-- One open live-chat support case per visitor. Collapse existing duplicates
-- (keep the most recently updated), then enforce it at the database.

WITH ranked_by_user AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY requester_user_id
      ORDER BY updated_at DESC, created_at DESC
    ) AS rn
  FROM public.support_cases
  WHERE source_channel = 'live_chat'
    AND status IS DISTINCT FROM 'resolved'
    AND requester_user_id IS NOT NULL
)
UPDATE public.support_cases c
SET
  status = 'resolved',
  resolved_at = COALESCE(c.resolved_at, now()),
  updated_at = now()
FROM ranked_by_user r
WHERE c.id = r.id
  AND r.rn > 1;

WITH ranked_by_email AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY lower(requester_email)
      ORDER BY updated_at DESC, created_at DESC
    ) AS rn
  FROM public.support_cases
  WHERE source_channel = 'live_chat'
    AND status IS DISTINCT FROM 'resolved'
    AND requester_email IS NOT NULL
    AND length(btrim(requester_email)) > 0
)
UPDATE public.support_cases c
SET
  status = 'resolved',
  resolved_at = COALESCE(c.resolved_at, now()),
  updated_at = now()
FROM ranked_by_email r
WHERE c.id = r.id
  AND r.rn > 1;

UPDATE public.contact_messages cm
SET support_status = 'resolved'
FROM public.support_cases c
WHERE cm.id = c.contact_message_id
  AND c.source_channel = 'live_chat'
  AND c.status = 'resolved'
  AND cm.source = 'live_chat'
  AND cm.support_status IS DISTINCT FROM 'resolved';

UPDATE public.live_chat_sessions s
SET
  status = 'resolved',
  resolved_at = COALESCE(s.resolved_at, now())
FROM public.support_cases c
WHERE s.support_case_id = c.id
  AND c.source_channel = 'live_chat'
  AND c.status = 'resolved'
  AND s.status IN ('open', 'assigned');

CREATE UNIQUE INDEX IF NOT EXISTS support_cases_one_open_live_chat_per_user
  ON public.support_cases (requester_user_id)
  WHERE source_channel = 'live_chat'
    AND status IS DISTINCT FROM 'resolved'
    AND requester_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS support_cases_one_open_live_chat_per_email
  ON public.support_cases (lower(requester_email))
  WHERE source_channel = 'live_chat'
    AND status IS DISTINCT FROM 'resolved'
    AND requester_email IS NOT NULL
    AND length(btrim(requester_email)) > 0;

COMMENT ON INDEX public.support_cases_one_open_live_chat_per_user IS
  'A visitor may have only one open live-chat ticket until it is resolved.';
