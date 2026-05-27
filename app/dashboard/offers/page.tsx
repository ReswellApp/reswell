import { redirect } from "next/navigation"
import { privatePageMetadata } from "@/lib/site-metadata"
import { DashboardOffersView } from "@/components/features/offers/dashboard-offers-view"
import { getCachedDashboardSession } from "@/lib/dashboard-session"
import { fetchDashboardOffersPartitioned } from "@/lib/db/offers-dashboard"
import { effectiveMinimumOfferPct } from "@/lib/utils/offers-minimum-pct"

export const metadata = privatePageMetadata({
  title: "Offers — Reswell",
  description: "Review offers you sent and offers others sent you.",
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

  const { sent, received, sellersById, buyersById, fetchError } =
    await fetchDashboardOffersPartitioned(supabase, user.id)

  const listingIds = [
    ...new Set([
      ...sent.map((o) => o.listing_id),
      ...received.map((o) => o.listing_id),
    ]),
  ]

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
        userId={user.id}
        defaultTab={defaultTab}
        made={sent}
        received={received}
        sellersById={sellersById}
        buyersById={buyersById}
        minPctByListingId={minPctByListingId}
      />
    </div>
  )
}
