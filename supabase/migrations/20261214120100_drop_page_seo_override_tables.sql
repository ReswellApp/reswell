-- Page SEO is code-managed in lib/seo/managed-pages.ts and lib/seo/dynamic-page-types.ts.
-- Legacy override tables are no longer used; ensure they stay dropped after earlier create migrations.

DROP TABLE IF EXISTS public.page_seo_override_history;
DROP TABLE IF EXISTS public.page_seo_overrides;
