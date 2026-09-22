import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { supabasePrimaryRestUrl, supabaseReadRestUrl } from "@/lib/supabase/rest-url"

function requireServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY")
  return key
}

/**
 * Service role against the **primary**. Writes, webhooks, read-your-writes.
 */
export function createServiceRoleClient() {
  return createSupabaseClient(supabasePrimaryRestUrl(), requireServiceRoleKey())
}

/**
 * Service role against the replica when `SUPABASE_READ_REPLICA_URL` is set.
 * Admin aggregates and other eventual-consistency analytics.
 */
export function createServiceRoleReadClient() {
  return createSupabaseClient(supabaseReadRestUrl(), requireServiceRoleKey())
}
