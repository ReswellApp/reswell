"use client"

import { useCallback, useEffect, useState } from "react"
import { Handshake } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { OfferRow } from "@/components/features/offers/offer-row"
import { SellerOfferResponseDialog, type OfferRowLite } from "@/components/features/messages/seller-offer-response-dialog"
import { BuyerCounterOfferDialog } from "@/components/features/offers/buyer-counter-offer-dialog"
import { capitalizeWords } from "@/lib/listing-labels"
import { MessagesOffersTabSkeleton } from "@/components/features/messages/messages-page-skeletons"
import { cn } from "@/lib/utils"
import { effectiveMinimumOfferPct } from "@/lib/utils/offers-minimum-pct"
import { latestSellerCounterNoteFromTimeline, openingOfferNoteFromTimeline } from "@/lib/utils/offer-timeline"
import type {
  DashboardOfferRow,
  DashboardProfileLite,
} from "@/lib/types/offers-dashboard"
import {
  dashboardListingForOffer,
  partitionOffersByDirection,
  shouldShowOfferInMessagesTab,
  userParticipationRole,
} from "@/lib/utils/offers-dashboard-display"
import { isAbortError } from "@/lib/utils/is-abort-error"
import { offerConversationKey } from "@/lib/utils/offer-messages-href"

type OfferSubTab = "sent" | "received"

type OfferDashboardRowRaw = Omit<DashboardOfferRow, "seller_counter_note" | "buyer_note"> & {
  offer_timeline?: unknown
}

function withSellerCounterNotes(rows: OfferDashboardRowRaw[]): DashboardOfferRow[] {
  return rows.map(({ offer_timeline, ...rest }) => ({
    ...rest,
    seller_counter_note:
      rest.status === "COUNTERED" ? latestSellerCounterNoteFromTimeline(offer_timeline) : null,
    buyer_note: openingOfferNoteFromTimeline(offer_timeline, { sellerInitiated: false }),
  }))
}

function mapProfiles(
  profiles: DashboardProfileLite[] | null,
): Record<string, DashboardProfileLite> {
  const map: Record<string, DashboardProfileLite> = {}
  for (const p of profiles ?? []) {
    map[p.id] = p
  }
  return map
}

const OFFER_SELECT = `
  id,
  status,
  current_amount,
  initial_amount,
  expires_at,
  created_at,
  updated_at,
  counter_count,
  listing_id,
  buyer_id,
  seller_id,
  seller_initiated,
  offer_timeline,
  fulfillment,
  shipping_amount,
  listings (
    id,
    title,
    slug,
    section,
    price,
    status,
    listing_images (url, is_primary, thumbnail_url)
  )
`

export function MessagesOffersTab({
  userId,
  searchQuery,
  shellClassName,
}: {
  userId: string
  searchQuery: string
  shellClassName?: string
}) {
  const supabase = createClient()
  const [subTab, setSubTab] = useState<OfferSubTab>("received")
  const [loading, setLoading] = useState(true)
  const [sent, setSent] = useState<DashboardOfferRow[]>([])
  const [received, setReceived] = useState<DashboardOfferRow[]>([])
  const [sellersById, setSellersById] = useState<Record<string, DashboardProfileLite>>({})
  const [buyersById, setBuyersById] = useState<Record<string, DashboardProfileLite>>({})
  const [minPctByListingId, setMinPctByListingId] = useState<Record<string, number>>({})
  const [dialogOffer, setDialogOffer] = useState<DashboardOfferRow | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [buyerCounterOffer, setBuyerCounterOffer] = useState<DashboardOfferRow | null>(null)
  const [buyerCounterOpen, setBuyerCounterOpen] = useState(false)
  const [conversationIdByOfferKey, setConversationIdByOfferKey] = useState<Record<string, string>>({})

  const loadOffers = useCallback(async (isActive: () => boolean = () => true) => {
    setLoading(true)
    try {
      const [{ data: madeData }, { data: receivedData }] = await Promise.all([
        supabase
          .from("offers")
          .select(OFFER_SELECT)
          .eq("buyer_id", userId)
          .order("updated_at", { ascending: false })
          .limit(200),
        supabase
          .from("offers")
          .select(OFFER_SELECT)
          .eq("seller_id", userId)
          .order("updated_at", { ascending: false })
          .limit(200),
      ])
      if (!isActive()) return

      const byId = new Map<string, OfferDashboardRowRaw>()
      for (const row of [...(madeData ?? []), ...(receivedData ?? [])]) {
        byId.set(row.id as string, row as OfferDashboardRowRaw)
      }
      const visible = withSellerCounterNotes([...byId.values()]).filter(
        shouldShowOfferInMessagesTab,
      )
      const { sent: sentOffers, received: receivedOffers } = partitionOffersByDirection(
        visible,
        userId,
      )
      setSent(sentOffers)
      setReceived(receivedOffers)

      const allOffers = [...sentOffers, ...receivedOffers]
      const listingIds = [...new Set(allOffers.map((o) => o.listing_id))]

      const sellerIds = [...new Set(allOffers.map((o) => o.seller_id))]
      const buyerIds = [...new Set(allOffers.map((o) => o.buyer_id))]

      const [profilesResult, listingMinResult, conversationsResult] = await Promise.all([
        Promise.all([
          sellerIds.length > 0
            ? supabase
                .from("profiles")
                .select("id, display_name, avatar_url, shop_name, is_shop")
                .in("id", sellerIds)
            : Promise.resolve({ data: [] as DashboardProfileLite[] }),
          buyerIds.length > 0
            ? supabase
                .from("profiles")
                .select("id, display_name, avatar_url, shop_name, is_shop")
                .in("id", buyerIds)
            : Promise.resolve({ data: [] as DashboardProfileLite[] }),
        ]),
        listingIds.length > 0
          ? supabase
              .from("listings")
              .select("id, minimum_offer_pct")
              .in("id", listingIds)
          : Promise.resolve({ data: [] as { id: string; minimum_offer_pct?: number | null }[] }),
        listingIds.length > 0
          ? supabase
              .from("conversations")
              .select("id, listing_id, buyer_id, seller_id")
              .in("listing_id", listingIds)
              .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
          : Promise.resolve({ data: [] as { id: string; listing_id: string | null; buyer_id: string; seller_id: string }[] }),
      ])
      if (!isActive()) return

      const [{ data: sellerProfiles }, { data: buyerProfiles }] = profilesResult
      setSellersById(mapProfiles((sellerProfiles ?? []) as DashboardProfileLite[]))
      setBuyersById(mapProfiles((buyerProfiles ?? []) as DashboardProfileLite[]))

      const nextConversationIds: Record<string, string> = {}
      for (const row of conversationsResult.data ?? []) {
        const listingId = row.listing_id
        if (!listingId) continue
        const key = offerConversationKey(listingId, row.buyer_id, row.seller_id)
        nextConversationIds[key] = row.id
      }
      setConversationIdByOfferKey(nextConversationIds)

      const nextMinPct: Record<string, number> = {}
      for (const row of listingMinResult.data ?? []) {
        const lid = row.id as string | undefined
        if (lid) {
          nextMinPct[lid] = effectiveMinimumOfferPct(
            row as { minimum_offer_pct?: number | null },
          )
        }
      }
      setMinPctByListingId(nextMinPct)

      if (isActive()) {
        setLoading(false)
      }
    } catch (err) {
      if (isActive() && !isAbortError(err)) {
        setLoading(false)
      }
    }
  }, [supabase, userId])

  useEffect(() => {
    let active = true
    void loadOffers(() => active).catch(() => {})
    return () => {
      active = false
    }
  }, [loadOffers])

  const searchLower = searchQuery.trim().toLowerCase()

  function filterOffers(offers: DashboardOfferRow[]): DashboardOfferRow[] {
    if (!searchLower) return offers
    return offers.filter((o) => {
      const listing = dashboardListingForOffer(o)
      const title = listing?.title?.toLowerCase() ?? ""
      const amount = String(o.current_amount)
      return title.includes(searchLower) || amount.includes(searchLower)
    })
  }

  const filteredSent = filterOffers(sent)
  const filteredReceived = filterOffers(received)
  const activeOffers = subTab === "sent" ? filteredSent : filteredReceived
  const activeTotal = subTab === "sent" ? sent.length : received.length

  const openRespond = (o: DashboardOfferRow) => {
    setDialogOffer(o)
    setDialogOpen(true)
  }

  const openBuyerCounter = (o: DashboardOfferRow) => {
    setBuyerCounterOffer(o)
    setBuyerCounterOpen(true)
  }

  const listingForDialog = dialogOffer ? dashboardListingForOffer(dialogOffer) : null
  const listPriceNum = listingForDialog
    ? Math.round(parseFloat(String(listingForDialog.price)) * 100) / 100
    : 0
  const minPct = dialogOffer ? minPctByListingId[dialogOffer.listing_id] ?? 70 : 70
  const minOfferAmount = Number.isFinite(listPriceNum)
    ? Math.round(listPriceNum * (minPct / 100) * 100) / 100
    : 0

  const offerRowLite: OfferRowLite | null = dialogOffer
    ? {
        id: dialogOffer.id,
        status: dialogOffer.status,
        current_amount: dialogOffer.current_amount,
        buyer_id: dialogOffer.buyer_id,
        seller_id: dialogOffer.seller_id,
        fulfillment: dialogOffer.fulfillment ?? null,
        shipping_amount: dialogOffer.shipping_amount ?? null,
      }
    : null

  const titleForDialog = listingForDialog?.title?.trim()
    ? capitalizeWords(listingForDialog.title)
    : "Listing"

  const listingForBuyerCounter = buyerCounterOffer ? dashboardListingForOffer(buyerCounterOffer) : null
  const listPriceBuyerCounter = listingForBuyerCounter
    ? Math.round(parseFloat(String(listingForBuyerCounter.price)) * 100) / 100
    : 0
  const titleBuyerCounter = listingForBuyerCounter?.title?.trim()
    ? capitalizeWords(listingForBuyerCounter.title)
    : "Listing"

  if (loading) {
    return <MessagesOffersTabSkeleton shellClassName={shellClassName} />
  }

  return (
    <>
      <div
        className="mb-4 flex w-full gap-1 rounded-xl border border-border/70 bg-muted/50 p-1"
        role="tablist"
        aria-label="Offers sent and received"
      >
        <button
          type="button"
          role="tab"
          aria-selected={subTab === "received"}
          onClick={() => setSubTab("received")}
          className={cn(
            "flex min-h-touch flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[14px] font-semibold transition-colors",
            subTab === "received"
              ? "bg-card text-foreground shadow-sm ring-1 ring-border/50"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Received
          {received.length > 0 && (
            <span className="tabular-nums text-[12px] font-medium text-muted-foreground">
              {filteredReceived.length !== received.length && searchLower
                ? `${filteredReceived.length}/${received.length}`
                : received.length}
            </span>
          )}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={subTab === "sent"}
          onClick={() => setSubTab("sent")}
          className={cn(
            "flex min-h-touch flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[14px] font-semibold transition-colors",
            subTab === "sent"
              ? "bg-card text-foreground shadow-sm ring-1 ring-border/50"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Sent
          {sent.length > 0 && (
            <span className="tabular-nums text-[12px] font-medium text-muted-foreground">
              {filteredSent.length !== sent.length && searchLower
                ? `${filteredSent.length}/${sent.length}`
                : sent.length}
            </span>
          )}
        </button>
      </div>

      {activeTotal === 0 ? (
        <div
          className={cn(
            "flex flex-col items-center px-6 py-14 text-center sm:py-16",
            shellClassName,
          )}
        >
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <Handshake className="h-7 w-7 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <h3 className="text-[17px] font-semibold text-foreground">
            {subTab === "sent" ? "No offers sent yet" : "No offers received yet"}
          </h3>
          <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-muted-foreground">
            {subTab === "sent"
              ? "Offers you started — as a buyer on a listing or as a seller offering to a buyer."
              : "Offers sent to you — from buyers on your listings or from sellers on boards you want."}
          </p>
        </div>
      ) : activeOffers.length === 0 ? (
        <div className={cn("px-4 py-10 text-center", shellClassName)}>
          <p className="text-[15px] text-muted-foreground">No matching offers.</p>
        </div>
      ) : (
        <div className={cn("space-y-3", shellClassName)}>
          {activeOffers.map((o) => {
            const role = userParticipationRole(o, userId) ?? "buyer"
            const conversationId =
              conversationIdByOfferKey[
                offerConversationKey(o.listing_id, o.buyer_id, o.seller_id)
              ] ?? null

            return (
            <OfferRow
              key={o.id}
              offer={o}
              role={role}
              counterparty={
                role === "buyer" ? sellersById[o.seller_id] : buyersById[o.buyer_id]
              }
              listingTitle={dashboardListingForOffer(o)?.title ?? ""}
              onRespondOpen={openRespond}
              onViewCounterOpen={role === "buyer" ? openBuyerCounter : undefined}
              conversationId={conversationId}
              compact
            />
            )
          })}
        </div>
      )}

      {offerRowLite && (
        <SellerOfferResponseDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open)
            if (!open) setDialogOffer(null)
          }}
          offer={offerRowLite}
          listingTitle={titleForDialog}
          listPrice={listPriceNum}
          minOfferAmount={minOfferAmount}
          minOfferPct={minPct}
          buyerNote={dialogOffer?.buyer_note}
          onCompleted={loadOffers}
        />
      )}

      {buyerCounterOffer && (
        <BuyerCounterOfferDialog
          open={buyerCounterOpen}
          onOpenChange={(open) => {
            setBuyerCounterOpen(open)
            if (!open) setBuyerCounterOffer(null)
          }}
          offer={{
            id: buyerCounterOffer.id,
            status: buyerCounterOffer.status,
            initial_amount: buyerCounterOffer.initial_amount,
            current_amount: buyerCounterOffer.current_amount,
            seller_counter_note: buyerCounterOffer.seller_counter_note,
            seller_initiated: buyerCounterOffer.seller_initiated ?? false,
            expires_at: buyerCounterOffer.expires_at,
            fulfillment: buyerCounterOffer.fulfillment ?? null,
            shipping_amount: buyerCounterOffer.shipping_amount ?? null,
          }}
          listingTitle={titleBuyerCounter}
          listPrice={listPriceBuyerCounter}
          onCompleted={loadOffers}
        />
      )}
    </>
  )
}
