"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { MessageCircle, ExternalLink, Handshake } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { SellerOfferResponseDialog, type OfferRowLite } from "@/components/features/messages/seller-offer-response-dialog"
import { BuyerCounterOfferDialog } from "@/components/features/offers/buyer-counter-offer-dialog"
import { capitalizeWords } from "@/lib/listing-labels"
import { listingDetailHref } from "@/lib/listing-href"
import { cn } from "@/lib/utils"
import type {
  DashboardOfferRow,
  DashboardProfileLite,
} from "@/lib/types/offers-dashboard"
import { dashboardListingForOffer } from "@/lib/utils/offers-dashboard-display"

function money(n: unknown): string {
  const v = typeof n === "number" ? n : parseFloat(String(n ?? "0"))
  if (!Number.isFinite(v)) return "0.00"
  return v.toFixed(2)
}

function statusLabel(status: string): string {
  switch (status) {
    case "PENDING":
      return "Pending"
    case "ACCEPTED":
      return "Accepted"
    case "DECLINED":
      return "Declined"
    case "COUNTERED":
      return "Countered"
    case "EXPIRED":
      return "Expired"
    case "WITHDRAWN":
      return "Withdrawn"
    case "COMPLETED":
      return "Completed"
    default:
      return status
  }
}

function statusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "ACCEPTED") return "default"
  if (status === "DECLINED" || status === "EXPIRED") return "secondary"
  if (status === "PENDING") return "outline"
  return "secondary"
}

function displayName(p: DashboardProfileLite | undefined): string {
  if (!p) return "Member"
  if (p.is_shop && p.shop_name?.trim()) return p.shop_name.trim()
  return p.display_name?.trim() || "Member"
}

function primaryImage(
  images: { url: string; is_primary: boolean | null }[] | null | undefined,
): string | null {
  if (!images?.length) return null
  const pr = images.find((i) => i.is_primary)
  return (pr ?? images[0]).url
}

type PriceLine = { label: string; value: string; emphasize?: boolean }

function offerTilePriceLines(
  role: "buyer" | "seller",
  offer: DashboardOfferRow,
  listPriceKnown: boolean,
  listPrice: number,
): PriceLine[] {
  const lines: PriceLine[] = []
  const initial = money(offer.initial_amount)
  const current = money(offer.current_amount)
  const asking = money(listPrice)

  if (listPriceKnown && Number.isFinite(listPrice) && listPrice > 0) {
    lines.push({ label: "Asking price", value: `$${asking}` })
  }

  if (role === "buyer") {
    if (offer.status === "COUNTERED") {
      lines.push({ label: "Your offer", value: `$${initial}` })
      lines.push({ label: "Seller's counter", value: `$${current}`, emphasize: true })
      return lines
    }
    lines.push({ label: "Your offer", value: `$${current}`, emphasize: true })
    return lines
  }

  // seller
  if (offer.status === "COUNTERED") {
    lines.push({ label: "Buyer offer", value: `$${initial}` })
    lines.push({ label: "Your counter", value: `$${current}`, emphasize: true })
    return lines
  }

  if (offer.status === "PENDING") {
    lines.push({ label: "Buyer offer", value: `$${current}`, emphasize: true })
    return lines
  }

  if (offer.status === "ACCEPTED" || offer.status === "COMPLETED") {
    lines.push({ label: "Agreed price", value: `$${current}`, emphasize: true })
    return lines
  }

  // Declined, expired, withdrawn, etc. — show last amount on the offer + opening if different
  if (initial !== current) {
    lines.push({ label: "Buyer offer (first)", value: `$${initial}` })
    lines.push({ label: "Last amount", value: `$${current}`, emphasize: true })
  } else {
    lines.push({ label: "Offer amount", value: `$${current}`, emphasize: true })
  }
  return lines
}

function OfferRow({
  offer,
  role,
  counterparty,
  listingTitle,
  onRespondOpen,
  onViewCounterOpen,
}: {
  offer: DashboardOfferRow
  role: "buyer" | "seller"
  counterparty: DashboardProfileLite | undefined
  listingTitle: string
  onRespondOpen: (o: DashboardOfferRow) => void
  onViewCounterOpen?: (o: DashboardOfferRow) => void
}) {
  const listing = dashboardListingForOffer(offer)
  const href = listing ? listingDetailHref(listing) : "#"
  const img = primaryImage(listing?.listing_images ?? null)
  const listPrice = listing ? parseFloat(String(listing.price)) : 0
  const otherId = role === "buyer" ? offer.seller_id : offer.buyer_id
  const messagesHref = `/messages?user=${otherId}&listing=${offer.listing_id}`

  const showRespond =
    role === "seller" && offer.status === "PENDING" && Number.isFinite(listPrice) && listPrice > 0

  const showViewCounter =
    role === "buyer" && offer.status === "COUNTERED" && typeof onViewCounterOpen === "function"

  const listPriceKnown = !!listing && Number.isFinite(listPrice) && listPrice > 0
  const priceLines = offerTilePriceLines(role, offer, listPriceKnown, listPrice)

  return (
    <Card className="overflow-hidden border-border/70 shadow-sm transition-colors hover:border-border">
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-stretch sm:gap-5">
        <Link
          href={href}
          className="relative h-24 w-full shrink-0 overflow-hidden rounded-xl bg-muted sm:h-auto sm:w-28"
        >
          {img ? (
            <Image src={img} alt="" fill className="object-cover" sizes="112px" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[11px] text-muted-foreground">
              No photo
            </div>
          )}
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <Link
                href={href}
                className="line-clamp-2 text-[17px] font-semibold leading-snug text-foreground hover:underline"
              >
                {capitalizeWords(listingTitle || "Listing")}
              </Link>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {role === "buyer" ? "Seller" : "Buyer"}:{" "}
                <span className="font-medium text-foreground">{displayName(counterparty)}</span>
              </p>
            </div>
            <Badge variant={statusVariant(offer.status)} className="shrink-0">
              {statusLabel(offer.status)}
            </Badge>
          </div>

          <div className="mt-3 rounded-xl border border-border/60 bg-muted/25 px-3 py-2.5">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Pricing
            </p>
            <dl className="space-y-1.5 text-[15px] tabular-nums">
              {priceLines.map((line) => (
                <div
                  key={line.label}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5"
                >
                  <dt className="text-[13px] text-muted-foreground">{line.label}</dt>
                  <dd
                    className={cn(
                      "text-right font-medium text-foreground",
                      line.emphasize && "text-[16px] font-semibold",
                    )}
                  >
                    {line.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <p className="mt-2 text-[12px] text-muted-foreground">
            Updated {formatDistanceToNow(new Date(offer.updated_at), { addSuffix: true })} · Expires{" "}
            {formatDistanceToNow(new Date(offer.expires_at), { addSuffix: true })}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="rounded-lg" asChild>
              <Link href={href}>
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                View listing
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="rounded-lg" asChild>
              <Link href={messagesHref}>
                <MessageCircle className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                Open messages
              </Link>
            </Button>
            {showViewCounter && (
              <Button
                size="sm"
                className="rounded-lg"
                type="button"
                onClick={() => onViewCounterOpen?.(offer)}
              >
                View counteroffer
              </Button>
            )}
            {showRespond && (
              <Button
                size="sm"
                className="rounded-lg"
                type="button"
                onClick={() => onRespondOpen(offer)}
              >
                Respond to offer
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

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
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Handshake className="h-7 w-7 text-foreground" aria-hidden />
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Offers
          </h1>
        </div>
        <p className="max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          Track offers you&apos;ve made and offers buyers have placed on your listings. Respond from
          here or continue the conversation in Messages.
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
        <TabsList className="grid h-12 w-full max-w-lg grid-cols-2 rounded-xl bg-muted/80 p-1">
          <TabsTrigger value="made" className="rounded-lg text-[15px] font-semibold">
            I made
            {madeCount > 0 && (
              <span className="ml-1.5 tabular-nums text-[13px] font-medium text-muted-foreground">
                ({madeCount})
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="received" className="rounded-lg text-[15px] font-semibold">
            On my listings
            {receivedCount > 0 && (
              <span className="ml-1.5 tabular-nums text-[13px] font-medium text-muted-foreground">
                ({receivedCount})
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="made" className="mt-6 space-y-4 focus-visible:outline-none">
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

        <TabsContent value="received" className="mt-6 space-y-4 focus-visible:outline-none">
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
        "rounded-2xl border border-dashed border-border/80 bg-muted/20 px-6 py-14 text-center",
      )}
    >
      <Handshake className="mx-auto h-10 w-10 text-muted-foreground/70" aria-hidden />
      <p className="mt-4 text-[17px] font-semibold text-foreground">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-muted-foreground">{body}</p>
    </div>
  )
}
