-- Surfboard / catalog models per brand (separate from `brands.model_count` display field).

CREATE TABLE IF NOT EXISTS public.brand_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands (id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT brand_models_name_nonempty CHECK (length(trim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS brand_models_brand_id_idx ON public.brand_models (brand_id);

CREATE UNIQUE INDEX IF NOT EXISTS brand_models_brand_name_lower_uidx
  ON public.brand_models (brand_id, lower(trim(name)));

ALTER TABLE public.brand_models ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "brand_models_select_public" ON public.brand_models;
CREATE POLICY "brand_models_select_public" ON public.brand_models FOR SELECT USING (true);

DROP POLICY IF EXISTS "brand_models_insert_admin" ON public.brand_models;
CREATE POLICY "brand_models_insert_admin" ON public.brand_models FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
);

DROP POLICY IF EXISTS "brand_models_update_admin" ON public.brand_models;
CREATE POLICY "brand_models_update_admin" ON public.brand_models FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
);

DROP POLICY IF EXISTS "brand_models_delete_admin" ON public.brand_models;
CREATE POLICY "brand_models_delete_admin" ON public.brand_models FOR DELETE
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
);
