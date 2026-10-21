import { redirect } from "next/navigation"
import { Suspense } from "react"
import { privatePageMetadata } from "@/lib/site-metadata"
import { getCachedRequestSession } from "@/lib/auth/cached-request-session"
import { getCachedDashboardSession } from "@/lib/dashboard-session"
import { fetchDashboardOffersPartitioned } from "@/lib/db/offers-dashboard"
import { fetchMyListingCartOfferProspects } from "@/lib/db/my-listings"
import { DashboardOffersView } from "@/components/features/offers/dashboard-offers-view"
import {
  offersPageLoginRedirect,
  parseOfferFocusId,
  parseOffersTab,
  shouldShowOfferInMessagesTab,
} from "@/lib/utils/offers-dashboard-display"
import { effectiveMinimumOfferPct } from "@/lib/utils/offers-minimum-pct"
import type { DashboardOfferRow } from "@/lib/types/offers-dashboard"
import { MessagesOffersPageSkeleton } from "@/components/features/messages/messages-page-skeletons"

export const metadata = privatePageMetadata({
  title: "Offers — Reswell",
  description: "View and respond to active offers on your listings and purchases.",
  path: "/messages/offers",
})

function mergeOffers(sent: DashboardOfferRow[], received: DashboardOfferRow[]): DashboardOfferRow[] {
  const byId = new Map<string, DashboardOfferRow>()
  for (const row of [...sent, ...received]) {
    byId.set(row.id, row)
  }
  return [...byId.values()]
    .filter(shouldShowOfferInMessagesTab)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
}

async function MessagesOffersContent({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; offer?: string }>
}) {
  const sp = await searchParams
  const defaultTab = parseOffersTab(sp.tab)
  const focusOfferId = parseOfferFocusId(sp.offer)

  const { supabase, user } = await getCachedDashboardSession()
  if (!user) {
    redirect(offersPageLoginRedirect("/messages/offers", sp))
  }

  const [{ sent, received, sellersById, buyersById, conversationIdByOfferKey }, cartOfferProspects] =
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

  return (
    <DashboardOffersView
      userId={user.id}
      defaultTab={defaultTab}
      offers={offers}
      sellersById={sellersById}
      buyersById={buyersById}
      minPctByListingId={minPctByListingId}
      conversationIdByOfferKey={conversationIdByOfferKey}
      cartOfferProspects={cartOfferProspects}
      focusOfferId={focusOfferId}
      activeOnlyDefault
      basePath="/messages/offers"
    />
  )
}

export default async function MessagesOffersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; offer?: string }>
}) {
  const sp = await searchParams
  const { user } = await getCachedRequestSession()
  if (!user) {
    redirect(offersPageLoginRedirect("/messages/offers", sp))
  }

  return (
    <Suspense fallback={<MessagesOffersPageSkeleton />}>
      <MessagesOffersContent searchParams={Promise.resolve(sp)} />
    </Suspense>
  )
}
