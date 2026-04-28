-- Snapshot → catalog convert may omit some dimension labels; empty strings are allowed.
ALTER TABLE public.brand_model_variants
  DROP CONSTRAINT IF EXISTS brand_model_variants_labels_nonempty;
