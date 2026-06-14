-- Page SEO is code-managed in lib/seo/managed-pages.ts. Drop legacy override tables.

DROP TABLE IF EXISTS public.page_seo_override_history;
DROP TABLE IF EXISTS public.page_seo_overrides;
