"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Handshake } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SellerOfferResponseDialog, type OfferRowLite } from "@/components/features/messages/seller-offer-response-dialog"
import { BuyerCounterOfferDialog } from "@/components/features/offers/buyer-counter-offer-dialog"
import { OfferRow } from "@/components/features/offers/offer-row"
import { capitalizeWords } from "@/lib/listing-labels"
import { cn } from "@/lib/utils"
import type {
  DashboardOfferRow,
  DashboardProfileLite,
} from "@/lib/types/offers-dashboard"
import { dashboardListingForOffer } from "@/lib/utils/offers-dashboard-display"

export function DashboardOffersView({
  made,
  received,
  sellersById,
  buyersById,
  minPctByListingId,
  defaultTab,
}: {
  made: DashboardOfferRow[]
  received: DashboardOfferRow[]
  sellersById: Record<string, DashboardProfileLite>
  buyersById: Record<string, DashboardProfileLite>
  minPctByListingId: Record<string, number>
  defaultTab: "made" | "received"
}) {
  const router = useRouter()
  const [tab, setTab] = useState<"made" | "received">(defaultTab)
  const [dialogOffer, setDialogOffer] = useState<DashboardOfferRow | null>(null)

  useEffect(() => {
    setTab(defaultTab)
  }, [defaultTab])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [buyerCounterOffer, setBuyerCounterOffer] = useState<DashboardOfferRow | null>(null)
  const [buyerCounterOpen, setBuyerCounterOpen] = useState(false)

  const syncUrl = (next: "made" | "received") => {
    const path =
      next === "received" ? "/dashboard/offers?tab=received" : "/dashboard/offers"
    router.replace(path, { scroll: false })
  }

  const madeCount = made.length
  const receivedCount = received.length

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

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <div className="flex items-center gap-1.5">
          <Handshake className="h-5 w-5 text-foreground/90" aria-hidden />
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            Offers
          </h1>
        </div>
        <p className="max-w-xl text-sm leading-snug text-muted-foreground">
          Offers you&apos;ve made and offers on your listings. Respond here or in Messages.
        </p>
      </header>

      <Tabs
        value={tab}
        onValueChange={(v) => {
          const next = v === "made" ? "made" : "received"
          setTab(next)
          syncUrl(next)
        }}
        className="w-full"
      >
        <TabsList className="grid h-9 w-full max-w-md grid-cols-2 rounded-lg border border-border/50 bg-muted/50 p-0.5">
          <TabsTrigger value="made" className="rounded-md text-xs font-medium sm:text-sm">
            I made
            {madeCount > 0 && (
              <span className="ml-1 tabular-nums text-[11px] font-normal text-muted-foreground sm:text-xs">
                ({madeCount})
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="received" className="rounded-md text-xs font-medium sm:text-sm">
            On my listings
            {receivedCount > 0 && (
              <span className="ml-1 tabular-nums text-[11px] font-normal text-muted-foreground sm:text-xs">
                ({receivedCount})
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="made" className="mt-4 space-y-3 focus-visible:outline-none">
          {made.length === 0 ? (
            <EmptyOffers
              title="No offers yet"
              body="When you make an offer on a listing, it will show up here with status and amounts."
            />
          ) : (
            made.map((o) => (
              <OfferRow
                key={o.id}
                offer={o}
                role="buyer"
                counterparty={sellersById[o.seller_id]}
                listingTitle={dashboardListingForOffer(o)?.title ?? ""}
                onRespondOpen={openRespond}
                onViewCounterOpen={openBuyerCounter}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="received" className="mt-4 space-y-3 focus-visible:outline-none">
          {received.length === 0 ? (
            <EmptyOffers
              title="No incoming offers"
              body="When a buyer makes an offer on one of your listings, you can review and respond here."
            />
          ) : (
            received.map((o) => (
              <OfferRow
                key={o.id}
                offer={o}
                role="seller"
                counterparty={buyersById[o.buyer_id]}
                listingTitle={dashboardListingForOffer(o)?.title ?? ""}
                onRespondOpen={openRespond}
              />
            ))
          )}
        </TabsContent>
      </Tabs>

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
          onCompleted={async () => {
            router.refresh()
          }}
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
          }}
          listingTitle={titleBuyerCounter}
          listPrice={listPriceBuyerCounter}
          onCompleted={async () => {
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

function EmptyOffers({ title, body }: { title: string; body: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-border/70 bg-muted/15 px-5 py-10 text-center sm:py-12",
      )}
    >
      <Handshake className="mx-auto h-8 w-8 text-muted-foreground/65" aria-hidden />
      <p className="mt-3 text-base font-semibold text-foreground">{title}</p>
      <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  )
}
