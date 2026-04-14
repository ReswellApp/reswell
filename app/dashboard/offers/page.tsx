import { redirect } from "next/navigation"
import { DashboardOffersView } from "@/components/features/offers/dashboard-offers-view"
import { getCachedDashboardSession } from "@/lib/dashboard-session"
import {
  fetchOffersMadeForDashboard,
  fetchOffersReceivedForDashboard,
} from "@/lib/db/offers-dashboard"

export default async function DashboardOffersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const sp = await searchParams
  const defaultTab = sp.tab === "received" ? "received" : "made"

  const { supabase, user } = await getCachedDashboardSession()
  if (!user) {
    redirect("/auth/login?redirect=/dashboard/offers")
  }

  const [madeRes, receivedRes] = await Promise.all([
    fetchOffersMadeForDashboard(supabase, user.id),
    fetchOffersReceivedForDashboard(supabase, user.id),
  ])

  const listingIds = [
    ...new Set([
      ...madeRes.offers.map((o) => o.listing_id),
      ...receivedRes.offers.map((o) => o.listing_id),
    ]),
  ]

  const minPctByListingId: Record<string, number> = {}
  if (listingIds.length > 0) {
    const { data: settings } = await supabase
      .from("offer_settings")
      .select("listing_id, minimum_offer_pct")
      .in("listing_id", listingIds)
    for (const row of settings ?? []) {
      const lid = row.listing_id as string | undefined
      if (lid) {
        minPctByListingId[lid] =
          typeof row.minimum_offer_pct === "number" ? row.minimum_offer_pct : 70
      }
    }
  }

  return (
    <DashboardOffersView
      defaultTab={defaultTab}
      made={madeRes.offers}
      received={receivedRes.offers}
      sellersById={madeRes.sellersById}
      buyersById={receivedRes.buyersById}
      minPctByListingId={minPctByListingId}
    />
  )
}
