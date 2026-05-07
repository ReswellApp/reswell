import { createClient as createSupabaseClient } from "@supabase/supabase-js"

/**
 * Anonymous `@supabase/supabase-js` client (no cookies / no `next/headers`).
 * Use for public reads in `generateStaticParams`, OG image routes, build-time
 * code, or whenever a cookie-bound client is not in scope. Respects RLS as the anon role.
 */
export function createAnonSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error(
      "Missing Supabase env: add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local or .env (see .env.example). Get values from https://supabase.com/dashboard/project/_/settings/api",
    )
  }
  return createSupabaseClient(url, key)
}
