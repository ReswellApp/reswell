-- Internal admin progress and bug tracker for /admin/reswelltickets.
-- Not customer support. Support tickets live in contact_messages.

CREATE TABLE IF NOT EXISTS public.reswell_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'in_progress', 'done')),
  due_date DATE,
  priority TEXT
    CHECK (priority IS NULL OR priority IN ('low', 'medium', 'high', 'urgent')),
  task_type TEXT
    CHECK (task_type IS NULL OR task_type IN ('feature', 'bug', 'ops', 'content', 'design', 'other')),
  effort_level TEXT
    CHECK (effort_level IS NULL OR effort_level IN ('xs', 's', 'm', 'l', 'xl')),
  description TEXT NOT NULL DEFAULT '',
  description_image_url TEXT,
  created_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reswell_tickets_status_updated
  ON public.reswell_tickets (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_reswell_tickets_due_date
  ON public.reswell_tickets (due_date);

CREATE INDEX IF NOT EXISTS idx_reswell_tickets_created_at
  ON public.reswell_tickets (created_at DESC);

CREATE TABLE IF NOT EXISTS public.reswell_ticket_assignees (
  ticket_id UUID NOT NULL REFERENCES public.reswell_tickets (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (ticket_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_reswell_ticket_assignees_user
  ON public.reswell_ticket_assignees (user_id);

CREATE TABLE IF NOT EXISTS public.reswell_ticket_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.reswell_tickets (id) ON DELETE CASCADE,
  author_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reswell_ticket_comments_ticket
  ON public.reswell_ticket_comments (ticket_id, created_at ASC);

CREATE TABLE IF NOT EXISTS public.reswell_ticket_subtasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.reswell_tickets (id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  completed BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reswell_ticket_subtasks_ticket
  ON public.reswell_ticket_subtasks (ticket_id, sort_order ASC);

CREATE TABLE IF NOT EXISTS public.reswell_ticket_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.reswell_tickets (id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'link'
    CHECK (kind IN ('pdf', 'drive', 'figma', 'image', 'link')),
  label TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL,
  created_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reswell_ticket_files_ticket
  ON public.reswell_ticket_files (ticket_id, created_at ASC);

ALTER TABLE public.reswell_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reswell_ticket_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reswell_ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reswell_ticket_subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reswell_ticket_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reswell_tickets_select_staff" ON public.reswell_tickets;
CREATE POLICY "reswell_tickets_select_staff" ON public.reswell_tickets
  FOR SELECT USING (public.is_admin_or_employee());

DROP POLICY IF EXISTS "reswell_tickets_insert_staff" ON public.reswell_tickets;
CREATE POLICY "reswell_tickets_insert_staff" ON public.reswell_tickets
  FOR INSERT WITH CHECK (public.is_admin_or_employee());

DROP POLICY IF EXISTS "reswell_tickets_update_staff" ON public.reswell_tickets;
CREATE POLICY "reswell_tickets_update_staff" ON public.reswell_tickets
  FOR UPDATE
  USING (public.is_admin_or_employee())
  WITH CHECK (public.is_admin_or_employee());

DROP POLICY IF EXISTS "reswell_tickets_delete_staff" ON public.reswell_tickets;
CREATE POLICY "reswell_tickets_delete_staff" ON public.reswell_tickets
  FOR DELETE USING (public.is_admin_or_employee());

DROP POLICY IF EXISTS "reswell_ticket_assignees_select_staff" ON public.reswell_ticket_assignees;
CREATE POLICY "reswell_ticket_assignees_select_staff" ON public.reswell_ticket_assignees
  FOR SELECT USING (public.is_admin_or_employee());

DROP POLICY IF EXISTS "reswell_ticket_assignees_insert_staff" ON public.reswell_ticket_assignees;
CREATE POLICY "reswell_ticket_assignees_insert_staff" ON public.reswell_ticket_assignees
  FOR INSERT WITH CHECK (public.is_admin_or_employee());

DROP POLICY IF EXISTS "reswell_ticket_assignees_delete_staff" ON public.reswell_ticket_assignees;
CREATE POLICY "reswell_ticket_assignees_delete_staff" ON public.reswell_ticket_assignees
  FOR DELETE USING (public.is_admin_or_employee());

DROP POLICY IF EXISTS "reswell_ticket_comments_select_staff" ON public.reswell_ticket_comments;
CREATE POLICY "reswell_ticket_comments_select_staff" ON public.reswell_ticket_comments
  FOR SELECT USING (public.is_admin_or_employee());

DROP POLICY IF EXISTS "reswell_ticket_comments_insert_staff" ON public.reswell_ticket_comments;
CREATE POLICY "reswell_ticket_comments_insert_staff" ON public.reswell_ticket_comments
  FOR INSERT WITH CHECK (public.is_admin_or_employee());

DROP POLICY IF EXISTS "reswell_ticket_comments_delete_staff" ON public.reswell_ticket_comments;
CREATE POLICY "reswell_ticket_comments_delete_staff" ON public.reswell_ticket_comments
  FOR DELETE USING (public.is_admin_or_employee());

DROP POLICY IF EXISTS "reswell_ticket_subtasks_select_staff" ON public.reswell_ticket_subtasks;
CREATE POLICY "reswell_ticket_subtasks_select_staff" ON public.reswell_ticket_subtasks
  FOR SELECT USING (public.is_admin_or_employee());

DROP POLICY IF EXISTS "reswell_ticket_subtasks_insert_staff" ON public.reswell_ticket_subtasks;
CREATE POLICY "reswell_ticket_subtasks_insert_staff" ON public.reswell_ticket_subtasks
  FOR INSERT WITH CHECK (public.is_admin_or_employee());

DROP POLICY IF EXISTS "reswell_ticket_subtasks_update_staff" ON public.reswell_ticket_subtasks;
CREATE POLICY "reswell_ticket_subtasks_update_staff" ON public.reswell_ticket_subtasks
  FOR UPDATE
  USING (public.is_admin_or_employee())
  WITH CHECK (public.is_admin_or_employee());

DROP POLICY IF EXISTS "reswell_ticket_subtasks_delete_staff" ON public.reswell_ticket_subtasks;
CREATE POLICY "reswell_ticket_subtasks_delete_staff" ON public.reswell_ticket_subtasks
  FOR DELETE USING (public.is_admin_or_employee());

DROP POLICY IF EXISTS "reswell_ticket_files_select_staff" ON public.reswell_ticket_files;
CREATE POLICY "reswell_ticket_files_select_staff" ON public.reswell_ticket_files
  FOR SELECT USING (public.is_admin_or_employee());

DROP POLICY IF EXISTS "reswell_ticket_files_insert_staff" ON public.reswell_ticket_files;
CREATE POLICY "reswell_ticket_files_insert_staff" ON public.reswell_ticket_files
  FOR INSERT WITH CHECK (public.is_admin_or_employee());

DROP POLICY IF EXISTS "reswell_ticket_files_delete_staff" ON public.reswell_ticket_files;
CREATE POLICY "reswell_ticket_files_delete_staff" ON public.reswell_ticket_files
  FOR DELETE USING (public.is_admin_or_employee());

COMMENT ON TABLE public.reswell_tickets IS
  'Internal admin progress and bug-fix tickets at /admin/reswelltickets. Not customer support.';
COMMENT ON TABLE public.reswell_ticket_assignees IS
  'Many-to-many staff assignees for reswell_tickets.';
COMMENT ON TABLE public.reswell_ticket_comments IS
  'Comments on internal admin progress/bug tickets.';
COMMENT ON TABLE public.reswell_ticket_subtasks IS
  'Checklist items on internal admin progress/bug tickets.';
COMMENT ON TABLE public.reswell_ticket_files IS
  'Linked supporting files (PDF, Drive, Figma, image, or URL) on internal admin tickets.';
