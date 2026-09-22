import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { supabasePrimaryRestUrl, supabaseReadRestUrl } from "@/lib/supabase/rest-url"

function requireAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!key) {
    throw new Error(
      "Missing Supabase env: add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local or .env (see .env.example). Get values from https://supabase.com/dashboard/project/_/settings/api",
    )
  }
  return key
}

/**
 * Anonymous client against the **primary** API.
 * Use for cache fills that must not store replica-lag misses (e.g. `/l` listing row).
 */
export function createAnonSupabaseClient() {
  return createSupabaseClient(supabasePrimaryRestUrl(), requireAnonKey())
}

/**
 * Anonymous client for eventual catalog reads.
 * Uses `SUPABASE_READ_REPLICA_URL` when set; otherwise the primary.
 */
export function createAnonReadClient() {
  return createSupabaseClient(supabaseReadRestUrl(), requireAnonKey())
}
