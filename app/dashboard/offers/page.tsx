import { redirect } from "next/navigation"
import { privatePageMetadata } from "@/lib/site-metadata"
import { DashboardOffersView } from "@/components/features/offers/dashboard-offers-view"
import { parseOffersTab } from "@/lib/utils/offers-dashboard-display"
import { getCachedDashboardSession } from "@/lib/dashboard-session"
import { fetchDashboardOffersPartitioned } from "@/lib/db/offers-dashboard"
import { fetchMyListingCartOfferProspects } from "@/lib/db/my-listings"
import { effectiveMinimumOfferPct } from "@/lib/utils/offers-minimum-pct"
import type { DashboardOfferRow } from "@/lib/types/offers-dashboard"

export const metadata = privatePageMetadata({
  title: "Offers — Reswell",
  description: "Review offers you sent and offers others sent you.",
  path: "/dashboard/offers",
})

function mergeOffers(sent: DashboardOfferRow[], received: DashboardOfferRow[]): DashboardOfferRow[] {
  const byId = new Map<string, DashboardOfferRow>()
  for (const row of [...sent, ...received]) {
    byId.set(row.id, row)
  }
  return [...byId.values()].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  )
}

export default async function DashboardOffersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const sp = await searchParams
  const defaultTab = parseOffersTab(sp.tab)

  const { supabase, user } = await getCachedDashboardSession()
  if (!user) {
    redirect("/auth/login?redirect=/dashboard/offers")
  }

  const [{ sent, received, sellersById, buyersById, fetchError }, cartOfferProspects] =
    await Promise.all([
      fetchDashboardOffersPartitioned(supabase, user.id),
      fetchMyListingCartOfferProspects(supabase, user.id),
    ])

  const offers = mergeOffers(sent, received)

  const listingIds = [...new Set(offers.map((o) => o.listing_id))]

  const minPctByListingId: Record<string, number> = {}
  if (listingIds.length > 0) {
    const { data: listingRows } = await supabase
      .from("listings")
      .select("id, minimum_offer_pct")
      .in("id", listingIds)

    for (const row of listingRows ?? []) {
      const lid = row.id as string | undefined
      if (lid) {
        minPctByListingId[lid] = effectiveMinimumOfferPct(
          row as { minimum_offer_pct?: number | null },
        )
      }
    }
  }

  const devFetchErrors =
    typeof fetchError === "string" && fetchError.length > 0 ? [fetchError] : []

  return (
    <div className="space-y-6">
      {process.env.NODE_ENV === "development" && devFetchErrors.length > 0 && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <p className="font-semibold text-destructive">Could not load offers from Supabase (dev only)</p>
          {devFetchErrors.map((msg) => (
            <p key={msg} className="mt-1 font-mono text-xs break-words opacity-90">
              {msg}
            </p>
          ))}
        </div>
      )}
      <DashboardOffersView
        userId={user.id}
        defaultTab={defaultTab}
        offers={offers}
        sellersById={sellersById}
        buyersById={buyersById}
        minPctByListingId={minPctByListingId}
        cartOfferProspects={cartOfferProspects}
      />
    </div>
  )
}
