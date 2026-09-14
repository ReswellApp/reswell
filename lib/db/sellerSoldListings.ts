import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleClient } from "@/lib/supabase/server"

const SOLD_SHIP_FROM_PROMPT_SECTIONS = ["surfboards", "fins"] as const

function serviceOrFallback(supabase: SupabaseClient): SupabaseClient {
  try {
    return createServiceRoleClient()
  } catch {
    return supabase
  }
}

/**
 * True when the seller has at least one sold surfboard or fin listing.
 * Query errors fail open (false) so we never prompt on uncertain data.
 */
export async function sellerHasSoldSurfboardsOrFins(
  _supabase: SupabaseClient,
  sellerUserId: string | null | undefined,
): Promise<boolean> {
  const uid = sellerUserId?.trim() ?? ""
  if (!uid) return false

  const client = serviceOrFallback(_supabase)

  const { data, error } = await client
    .from("listings")
    .select("id")
    .eq("user_id", uid)
    .in("section", [...SOLD_SHIP_FROM_PROMPT_SECTIONS])
    .eq("status", "sold")
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error(
      "[sellerSoldListings] sold boards/fins lookup failed:",
      error.message,
    )
    return false
  }

  return Boolean(data?.id)
}
