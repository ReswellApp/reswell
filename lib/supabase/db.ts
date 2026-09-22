import type { SupabaseClient } from "@supabase/supabase-js"
import { createAnonReadClient, createAnonSupabaseClient } from "@/lib/supabase/anon"
import {
  createServiceRoleClient,
  createServiceRoleReadClient,
} from "@/lib/supabase/service-role"

export type DbConsistency = "strong" | "eventual"
export type DbPurpose = "catalog" | "analytics"

/**
 * Query-class router.
 *
 * - `strong` + `catalog` — primary anon (listing-row cache fills after publish)
 * - `eventual` + `catalog` — replica anon (home, boards, sold, nav, similar)
 * - `strong` + `analytics` — primary service role (writes, read-your-writes)
 * - `eventual` + `analytics` — replica service role (pulse, badges, BI reads)
 *
 * Session/auth stays on `createClient()` — never route JWTs at the replica.
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
