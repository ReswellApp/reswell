-- Careers applications: on-site apply form + staff inbox for resumes.

CREATE TABLE IF NOT EXISTS public.career_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_slug text,
  role_title text NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  surfing_note text NOT NULL,
  favorite_board text NOT NULL,
  resume_storage_path text,
  resume_file_name text,
  resume_mime_type text,
  resume_size_bytes integer,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT career_applications_name_nonempty CHECK (char_length(trim(name)) > 0),
  CONSTRAINT career_applications_email_nonempty CHECK (char_length(trim(email)) > 0),
  CONSTRAINT career_applications_role_title_nonempty CHECK (char_length(trim(role_title)) > 0),
  CONSTRAINT career_applications_surfing_nonempty CHECK (char_length(trim(surfing_note)) > 0),
  CONSTRAINT career_applications_favorite_nonempty CHECK (char_length(trim(favorite_board)) > 0),
  CONSTRAINT career_applications_status_check CHECK (status IN ('new', 'reviewed', 'archived')),
  CONSTRAINT career_applications_resume_size_check CHECK (
    resume_size_bytes IS NULL
    OR (resume_size_bytes > 0 AND resume_size_bytes <= 4194304)
  )
);

COMMENT ON TABLE public.career_applications IS
  'Public /careers applications. Optional resume lives in the career-resumes bucket.';

CREATE INDEX IF NOT EXISTS career_applications_created_idx
  ON public.career_applications (created_at DESC);

CREATE INDEX IF NOT EXISTS career_applications_status_created_idx
  ON public.career_applications (status, created_at DESC)
  WHERE status = 'new';

ALTER TABLE public.career_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS career_applications_select_staff ON public.career_applications;
CREATE POLICY career_applications_select_staff
  ON public.career_applications FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.is_admin = true OR p.is_employee = true)
    )
  );

DROP POLICY IF EXISTS career_applications_update_staff ON public.career_applications;
CREATE POLICY career_applications_update_staff
  ON public.career_applications FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.is_admin = true OR p.is_employee = true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.is_admin = true OR p.is_employee = true)
    )
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'career-resumes',
  'career-resumes',
  false,
  4194304,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS career_resumes_select_staff ON storage.objects;
CREATE POLICY career_resumes_select_staff
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'career-resumes'
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.is_admin = true OR p.is_employee = true)
    )
  );
