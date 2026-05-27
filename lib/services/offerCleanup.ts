import type { SupabaseClient } from "@supabase/supabase-js"

export type OfferCleanupSummary = {
  expiredDeleted: number
  terminalDeleted: number
  soldListingOrphansDeleted: number
}

/**
 * Removes offer rows that should no longer appear in Messages or /dashboard/offers.
 * Keeps COMPLETED (and legacy ACCEPTED) winning records on sold listings.
 */
export async function purgeStaleOffers(
  serviceSupabase: SupabaseClient,
  referenceTime: Date = new Date(),
): Promise<OfferCleanupSummary> {
  const nowIso = referenceTime.toISOString()
  const summary: OfferCleanupSummary = {
    expiredDeleted: 0,
    terminalDeleted: 0,
    soldListingOrphansDeleted: 0,
  }

  const { data: expiredRows, error: expiredErr } = await serviceSupabase
    .from("offers")
    .select("id")
    .in("status", ["PENDING", "COUNTERED", "ACCEPTED"])
    .lt("expires_at", nowIso)
    .limit(500)

  if (expiredErr) {
    console.error("[purgeStaleOffers] expired select:", expiredErr)
  } else if (expiredRows?.length) {
    const ids = expiredRows.map((r) => r.id as string)
    const { error: delErr, count } = await serviceSupabase
      .from("offers")
      .delete({ count: "exact" })
      .in("id", ids)
    if (delErr) {
      console.error("[purgeStaleOffers] expired delete:", delErr)
    } else {
      summary.expiredDeleted = count ?? ids.length
    }
  }

  const { data: terminalRows, error: terminalErr } = await serviceSupabase
    .from("offers")
    .select("id")
    .in("status", ["DECLINED", "EXPIRED", "WITHDRAWN"])
    .limit(500)

  if (terminalErr) {
    console.error("[purgeStaleOffers] terminal select:", terminalErr)
  } else if (terminalRows?.length) {
    const ids = terminalRows.map((r) => r.id as string)
    const { error: delErr, count } = await serviceSupabase
      .from("offers")
      .delete({ count: "exact" })
      .in("id", ids)
    if (delErr) {
      console.error("[purgeStaleOffers] terminal delete:", delErr)
    } else {
      summary.terminalDeleted = count ?? ids.length
    }
  }

  const { data: soldListings, error: soldListErr } = await serviceSupabase
    .from("listings")
    .select("id")
    .eq("status", "sold")
    .limit(500)

  if (soldListErr) {
    console.error("[purgeStaleOffers] sold listings:", soldListErr)
    return summary
  }

  const soldIds = (soldListings ?? []).map((r) => r.id as string)
  if (soldIds.length === 0) return summary

  const { data: orphanOffers, error: orphanErr } = await serviceSupabase
    .from("offers")
    .select("id, status, listing_id")
    .in("listing_id", soldIds)
    .neq("status", "COMPLETED")
    .limit(500)

  if (orphanErr) {
    console.error("[purgeStaleOffers] orphan select:", orphanErr)
    return summary
  }

  const orphanIds = (orphanOffers ?? [])
    .filter((o) => o.status !== "ACCEPTED")
    .map((o) => o.id as string)

  if (orphanIds.length === 0) return summary

  const { error: orphanDelErr, count } = await serviceSupabase
    .from("offers")
    .delete({ count: "exact" })
    .in("id", orphanIds)

  if (orphanDelErr) {
    console.error("[purgeStaleOffers] orphan delete:", orphanDelErr)
  } else {
    summary.soldListingOrphansDeleted = count ?? orphanIds.length
  }

  return summary
}

/** After a sale, drop every other offer on the listing(s); keep the winning row when provided. */
export async function deleteNonWinningOffersOnListings(
  serviceSupabase: SupabaseClient,
  listingIds: string[],
  keepOfferId?: string | null,
): Promise<void> {
  if (listingIds.length === 0) return

  let query = serviceSupabase.from("offers").delete().in("listing_id", listingIds)
  if (keepOfferId?.trim()) {
    query = query.neq("id", keepOfferId.trim())
  }

  const { error } = await query
  if (error) {
    console.error("[deleteNonWinningOffersOnListings]", error)
  }
}

/** Delete a single offer after decline or other terminal negotiation (service role). */
export async function deleteOfferRecord(
  serviceSupabase: SupabaseClient,
  offerId: string,
): Promise<void> {
  const id = offerId.trim()
  if (!id) return

  const { error } = await serviceSupabase.from("offers").delete().eq("id", id)
  if (error) {
    console.error("[deleteOfferRecord]", error)
  }
}
