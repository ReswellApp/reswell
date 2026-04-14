import type { DashboardListingEmbed, DashboardOfferRow } from "@/lib/types/offers-dashboard"

function singleListing(
  row: DashboardOfferRow["listings"],
): DashboardListingEmbed | null {
  if (!row) return null
  return Array.isArray(row) ? row[0] ?? null : row
}

export function dashboardListingForOffer(row: DashboardOfferRow): DashboardListingEmbed | null {
  return singleListing(row.listings)
}
