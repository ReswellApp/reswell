import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { supabasePrimaryRestUrl } from "@/lib/supabase/rest-url"

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
 * Service role for analytics reads (`getDb({ consistency: "eventual", purpose: "analytics" })`).
 * Always the primary project.
 */
export function createServiceRoleReadClient() {
  return createServiceRoleClient()
}
