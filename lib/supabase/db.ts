import type { SupabaseClient } from "@supabase/supabase-js"
import { createAnonReadClient, createAnonSupabaseClient } from "@/lib/supabase/anon"
import {
  createServiceRoleClient,
  createServiceRoleReadClient,
} from "@/lib/supabase/service-role"

export type DbConsistency = "strong" | "eventual"
export type DbPurpose = "catalog" | "analytics"

/**
 * Query-class router. Every mode uses the primary project.
 *
 * - `catalog` — anon (home, boards, sold, nav, similar, listing-row cache)
 * - `analytics` — service role (pulse, badges, BI, writes, read-your-writes)
 *
 * `consistency` does not select a host. Session/auth stays on `createClient()`.
 */
export function getDb(options: {
  consistency: DbConsistency
  purpose?: DbPurpose
}): SupabaseClient {
  const purpose = options.purpose ?? "catalog"
  if (purpose === "analytics") {
    return options.consistency === "eventual"
      ? createServiceRoleReadClient()
      : createServiceRoleClient()
  }
  return options.consistency === "eventual"
    ? createAnonReadClient()
    : createAnonSupabaseClient()
}
