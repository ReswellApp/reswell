import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { supabasePrimaryRestUrl } from "@/lib/supabase/rest-url"

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
 * Anonymous client against the primary API.
 * Catalog cache fills, including eventual reads, use this same project.
 */
export function createAnonSupabaseClient() {
  return createSupabaseClient(supabasePrimaryRestUrl(), requireAnonKey())
}

/**
 * Anonymous client for catalog reads (`getDb({ consistency: "eventual" })`).
 * Always the primary project.
 */
export function createAnonReadClient() {
  return createAnonSupabaseClient()
}
