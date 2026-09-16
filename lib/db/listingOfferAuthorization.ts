import type { SupabaseClient } from "@supabase/supabase-js"

export type OfferAuthorizationRow = {
  id: string
  payment_intent_id: string | null
}

export async function fetchOfferAuthorizationRows(
  supabase: SupabaseClient,
  offerIds: string[],
): Promise<OfferAuthorizationRow[]> {
  const ids = [...new Set(offerIds.map((id) => id.trim()).filter(Boolean))]
  if (ids.length === 0) return []

  const { data, error } = await supabase
    .from("offers")
    .select("id, payment_intent_id")
    .in("id", ids)

  if (error || !data) return []
  return data as OfferAuthorizationRow[]
}

export async function fetchOfferAuthorizationRowsForListings(
  supabase: SupabaseClient,
  listingIds: string[],
  excludeOfferId?: string | null,
): Promise<OfferAuthorizationRow[]> {
  const ids = [...new Set(listingIds.map((id) => id.trim()).filter(Boolean))]
  if (ids.length === 0) return []

  let query = supabase.from("offers").select("id, payment_intent_id").in("listing_id", ids)
  const keep = excludeOfferId?.trim()
  if (keep) {
    query = query.neq("id", keep)
  }

  const { data, error } = await query
  if (error || !data) return []
  return data as OfferAuthorizationRow[]
}
