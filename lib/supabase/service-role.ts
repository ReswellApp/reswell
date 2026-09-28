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
 * Service role for lag-tolerant analytics reads.
 * Uses `SUPABASE_READ_REPLICA_URL` when it is an HTTPS API URL; otherwise the primary.
 */
export function createServiceRoleReadClient() {
  return createSupabaseClient(supabaseReadRestUrl(), requireServiceRoleKey())
}
