import { redirect } from "next/navigation"
import { privatePageMetadata } from "@/lib/site-metadata"
import { DashboardOffersView } from "@/components/features/offers/dashboard-offers-view"
import { getCachedDashboardSession } from "@/lib/dashboard-session"
import {
  fetchOffersMadeForDashboard,
  fetchOffersReceivedForDashboard,
} from "@/lib/db/offers-dashboard"

export const metadata = privatePageMetadata({
  title: "Offers — Reswell",
  description: "Review offers you made and offers buyers sent on your surfboard listings.",
  path: "/dashboard/offers",
})

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

  const devFetchErrors = [...new Set(
    [madeRes.fetchError, receivedRes.fetchError].filter(
      (e): e is string => typeof e === "string" && e.length > 0,
    ),
  )]

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
          <p className="mt-3 text-[13px] leading-snug text-muted-foreground">
            Confirm <code className="rounded bg-muted px-1 py-0.5 text-foreground">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-foreground">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-foreground">.env.local</code> match the project that has
            your data, and that offer tables exist (see{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-foreground">scripts/046_offers.sql</code>). In Supabase →
            Authentication → URL Configuration, add{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-foreground">http://localhost:3000/**</code> so sign-in
            works locally.
          </p>
        </div>
      )}
      <DashboardOffersView
        defaultTab={defaultTab}
        made={madeRes.offers}
        received={receivedRes.offers}
        sellersById={madeRes.sellersById}
        buyersById={receivedRes.buyersById}
        minPctByListingId={minPctByListingId}
      />
    </div>
  )
}
