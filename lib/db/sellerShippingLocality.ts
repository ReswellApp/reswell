import type { SupabaseClient } from "@supabase/supabase-js"

import { createServiceRoleClient } from "@/lib/supabase/server"

const SHIPPING_PROMPT_STATUSES = ["active", "sold", "pending", "pending_sale"] as const

export type SellerShippingLocality = {
  offersShipping: boolean
  city: string | null
  state: string | null
}

const EMPTY: SellerShippingLocality = {
  offersShipping: false,
  city: null,
  state: null,
}

function serviceOrFallback(supabase: SupabaseClient): SupabaseClient {
  try {
    return createServiceRoleClient()
  } catch {
    return supabase
  }
}

/**
 * Latest non-draft listing this seller offers shipping on.
 * City and state only — never a street. Query errors fail closed.
 */
export async function fetchSellerShippingLocality(
  supabase: SupabaseClient,
  sellerUserId: string | null | undefined,
): Promise<SellerShippingLocality> {
  const uid = sellerUserId?.trim() ?? ""
  if (!uid) return EMPTY

  const client = serviceOrFallback(supabase)
  const { data, error } = await client
    .from("listings")
    .select("city, state")
    .eq("user_id", uid)
    .eq("shipping_available", true)
    .in("status", [...SHIPPING_PROMPT_STATUSES])
    .order("updated_at", { ascending: false })
    .limit(12)

  if (error || !data || data.length === 0) {
    if (error) {
      console.error("[sellerShippingLocality] lookup failed:", error.message)
    }
    return EMPTY
  }

  for (const row of data) {
    const city = typeof row.city === "string" ? row.city.trim() : ""
    if (!city) continue
    const state = typeof row.state === "string" ? row.state.trim() : ""
    return { offersShipping: true, city, state: state || null }
  }

  return { offersShipping: true, city: null, state: null }
}
