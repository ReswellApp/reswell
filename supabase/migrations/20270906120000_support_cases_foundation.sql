-- Support Cases foundation: status lifecycle for order help + unified cases table.
-- Phase 1 adapters continue reading legacy tables; APIs dual-write into support_cases.

-- ---------------------------------------------------------------------------
-- 1) Order support requests: status, role, assignee, outcome
-- ---------------------------------------------------------------------------

ALTER TABLE public.order_support_requests
  ADD COLUMN IF NOT EXISTS support_status text NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS requester_role text NOT NULL DEFAULT 'buyer',
  ADD COLUMN IF NOT EXISTS assignee_admin_id uuid,
  ADD COLUMN IF NOT EXISTS internal_notes text,
  ADD COLUMN IF NOT EXISTS outcome text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_support_requests_support_status_check'
  ) THEN
    ALTER TABLE public.order_support_requests
      ADD CONSTRAINT order_support_requests_support_status_check
      CHECK (support_status IN (
        'new', 'triaged', 'waiting_on_customer', 'investigating', 'resolved', 'closed'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_support_requests_requester_role_check'
  ) THEN
    ALTER TABLE public.order_support_requests
      ADD CONSTRAINT order_support_requests_requester_role_check
      CHECK (requester_role IN ('buyer', 'seller'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_support_requests_outcome_check'
  ) THEN
    ALTER TABLE public.order_support_requests
      ADD CONSTRAINT order_support_requests_outcome_check
      CHECK (
        outcome IS NULL
        OR outcome IN ('approved', 'partial', 'denied', 'withdrawn', 'cancelled', 'informed')
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS order_support_requests_status_created_idx
  ON public.order_support_requests (support_status, created_at DESC);

CREATE INDEX IF NOT EXISTS order_support_requests_buyer_id_created_idx
  ON public.order_support_requests (buyer_id, created_at DESC);

COMMENT ON COLUMN public.order_support_requests.requester_role IS
  'buyer or seller who opened the request (buyer_id stores the requester user id).';
COMMENT ON COLUMN public.order_support_requests.support_status IS
  'CS workflow status for order-linked help and claims.';

-- ---------------------------------------------------------------------------
-- 2) Unified support_cases (Phase 2 canonical store; dual-written from APIs)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.support_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number text NOT NULL,
  kind text NOT NULL,
  status text NOT NULL DEFAULT 'submitted',
  priority text NOT NULL DEFAULT 'normal',
  subject text NOT NULL,
  preview text NOT NULL DEFAULT '',
  requester_user_id uuid,
  requester_email text,
  requester_role text NOT NULL DEFAULT 'member',
  order_id uuid REFERENCES public.orders (id) ON DELETE SET NULL,
  order_ref text,
  listing_id uuid,
  conversation_id uuid,
  contact_message_id uuid,
  order_support_request_id uuid,
  assignee_admin_id uuid,
  sla_due_at timestamptz,
  outcome text,
  internal_notes text,
  source_channel text NOT NULL DEFAULT 'help_hub',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CONSTRAINT support_cases_kind_check CHECK (kind IN (
    'general', 'order_question', 'cancel_request', 'protection_claim',
    'safety', 'payments', 'account'
  )),
  CONSTRAINT support_cases_status_check CHECK (status IN (
    'submitted', 'in_review', 'in_progress', 'waiting_on_you', 'resolved'
  )),
  CONSTRAINT support_cases_priority_check CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  CONSTRAINT support_cases_requester_role_check CHECK (requester_role IN (
    'buyer', 'seller', 'member', 'guest'
  )),
  CONSTRAINT support_cases_outcome_check CHECK (
    outcome IS NULL
    OR outcome IN ('approved', 'partial', 'denied', 'withdrawn', 'cancelled', 'informed')
  ),
  CONSTRAINT support_cases_case_number_key UNIQUE (case_number)
);

CREATE INDEX IF NOT EXISTS support_cases_status_updated_idx
  ON public.support_cases (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS support_cases_requester_idx
  ON public.support_cases (requester_user_id, updated_at DESC)
  WHERE requester_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS support_cases_order_idx
  ON public.support_cases (order_id)
  WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS support_cases_assignee_idx
  ON public.support_cases (assignee_admin_id, status)
  WHERE assignee_admin_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.support_case_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.support_cases (id) ON DELETE CASCADE,
  author_user_id uuid,
  author_role text NOT NULL DEFAULT 'customer',
  body text NOT NULL,
  is_internal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_case_messages_author_role_check CHECK (author_role IN (
    'customer', 'agent', 'system'
  ))
);

CREATE INDEX IF NOT EXISTS support_case_messages_case_created_idx
  ON public.support_case_messages (case_id, created_at ASC);

CREATE TABLE IF NOT EXISTS public.support_case_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.support_cases (id) ON DELETE CASCADE,
  actor_admin_id uuid,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_case_events_case_created_idx
  ON public.support_case_events (case_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.support_macros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  kind_filter text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_macros_active_sort_idx
  ON public.support_macros (is_active, sort_order);

COMMENT ON TABLE public.support_cases IS
  'Unified customer support cases (Help Hub). Dual-written alongside contact_messages / order_support_requests during migration.';

ALTER TABLE public.support_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_case_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_case_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_macros ENABLE ROW LEVEL SECURITY;

-- Members: read own cases + non-internal messages
DROP POLICY IF EXISTS support_cases_select_own ON public.support_cases;
CREATE POLICY support_cases_select_own ON public.support_cases
  FOR SELECT
  TO authenticated
  USING (
    requester_user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND (p.is_admin = true OR p.is_employee = true)
    )
  );

DROP POLICY IF EXISTS support_case_messages_select_own ON public.support_case_messages;
CREATE POLICY support_case_messages_select_own ON public.support_case_messages
  FOR SELECT
  TO authenticated
  USING (
    (
      is_internal = false
      AND EXISTS (
        SELECT 1 FROM public.support_cases c
        WHERE c.id = case_id AND c.requester_user_id = (SELECT auth.uid())
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND (p.is_admin = true OR p.is_employee = true)
    )
  );

DROP POLICY IF EXISTS support_case_messages_insert_own ON public.support_case_messages;
CREATE POLICY support_case_messages_insert_own ON public.support_case_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    author_role = 'customer'
    AND is_internal = false
    AND author_user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.support_cases c
      WHERE c.id = case_id
        AND c.requester_user_id = (SELECT auth.uid())
        AND c.status <> 'resolved'
    )
  );

DROP POLICY IF EXISTS support_case_events_select_staff ON public.support_case_events;
CREATE POLICY support_case_events_select_staff ON public.support_case_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND (p.is_admin = true OR p.is_employee = true)
    )
  );

DROP POLICY IF EXISTS support_macros_select_staff ON public.support_macros;
CREATE POLICY support_macros_select_staff ON public.support_macros
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND (p.is_admin = true OR p.is_employee = true)
    )
  );

-- Seed starter macros for CS cockpit
INSERT INTO public.support_macros (title, body, kind_filter, sort_order)
SELECT * FROM (VALUES
  (
    'Thanks — looking into it',
    'Hi {{name}}, thanks for reaching out about {{order_ref}}. I''m looking into this now and will update you shortly.',
    NULL,
    10
  ),
  (
    'Message the seller first',
    'Hi {{name}}, for the fastest resolution please message the seller from your order page and share what you find. Reply here if you still need us after that.',
    'protection_claim',
    20
  ),
  (
    'Need photos',
    'Hi {{name}}, could you reply with clear photos of the issue (item, packaging, and any damage)? That helps us decide the next step under Purchase Protection.',
    'protection_claim',
    30
  ),
  (
    'Claim approved — refund',
    'Hi {{name}}, we''ve approved your Purchase Protection claim for {{order_ref}}. A refund is being processed — allow a few business days for it to appear on your statement.',
    'protection_claim',
    40
  ),
  (
    'Cancel confirmed',
    'Hi {{name}}, we''ve cancelled order {{order_ref}}. If you paid by card, the refund will post in a few business days.',
    'cancel_request',
    50
  )
) AS v(title, body, kind_filter, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.support_macros LIMIT 1);
