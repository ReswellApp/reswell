"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import {
  ArrowUpRight,
  Clock,
  Handshake,
  MessageCircle,
  Timer,
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SellerOfferResponseDialog, type OfferRowLite } from "@/components/features/messages/seller-offer-response-dialog"
import { BuyerCounterOfferDialog } from "@/components/features/offers/buyer-counter-offer-dialog"
import { capitalizeWords } from "@/lib/listing-labels"
import { listingDetailHref } from "@/lib/listing-href"
import { listingCardImageSrc } from "@/lib/listing-image-display"
import { portraitShimmer } from "@/lib/image-shimmer"
import { homeListingScrollImageSizes } from "@/lib/home-listing-scroll-styles"
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

/** Left accent on the details pane — stage hue, flat (no alpha). */
function statusContentAccent(status: string): string {
  switch (status) {
    case "PENDING":
      return "border-l-amber-500 dark:border-l-amber-400"
    case "ACCEPTED":
    case "COMPLETED":
      return "border-l-emerald-600 dark:border-l-emerald-500"
    case "COUNTERED":
      return "border-l-sky-600 dark:border-l-sky-500"
    case "DECLINED":
    case "WITHDRAWN":
      return "border-l-neutral-400 dark:border-l-neutral-500"
    case "EXPIRED":
      return "border-l-neutral-500 dark:border-l-neutral-600"
    default:
      return "border-l-border"
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "PENDING":
      return "border-amber-300 bg-amber-100 text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
    case "ACCEPTED":
    case "COMPLETED":
      return "border-emerald-300 bg-emerald-100 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100"
    case "COUNTERED":
      return "border-sky-300 bg-sky-100 text-sky-950 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-100"
    case "DECLINED":
    case "WITHDRAWN":
      return "border-neutral-300 bg-neutral-100 text-neutral-700 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-300"
    case "EXPIRED":
      return "border-neutral-400 bg-neutral-200 text-neutral-800 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200"
    default:
      return "border-border bg-muted text-foreground"
  }
}

function displayName(p: DashboardProfileLite | undefined): string {
  if (!p) return "Member"
  if (p.is_shop && p.shop_name?.trim()) return p.shop_name.trim()
  return p.display_name?.trim() || "Member"
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
  const imageSrc = listingCardImageSrc(listing?.listing_images ?? null)
  const hasListingImage = Boolean(imageSrc)
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
    <article
      className={cn(
        "group overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm transition-[border-color,box-shadow] duration-200 dark:bg-card/80",
        "hover:border-border/90 hover:shadow",
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-stretch">
        <Link
          href={href}
          className={cn(
            "relative aspect-[3/4] w-full max-w-[13rem] shrink-0 overflow-hidden bg-muted sm:max-w-none sm:w-52",
            "mx-auto sm:mx-0",
          )}
          aria-label={listingTitle ? `View listing: ${listingTitle}` : "View listing"}
        >
          {hasListingImage ? (
            <Image
              src={imageSrc}
              alt={listingTitle ? capitalizeWords(listingTitle) : "Listing"}
              fill
              sizes={homeListingScrollImageSizes}
              placeholder="blur"
              blurDataURL={portraitShimmer}
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
              No Image
            </div>
          )}
        </Link>

        <div
          className={cn(
            "flex min-w-0 flex-1 flex-col border-l-2 px-3 py-3 sm:px-4 sm:py-3.5",
            statusContentAccent(offer.status),
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-2 gap-y-1">
            <div className="min-w-0 flex-1">
              <Link
                href={href}
                className="line-clamp-2 text-base font-semibold leading-snug tracking-tight text-foreground transition-colors hover:text-foreground/80"
              >
                {capitalizeWords(listingTitle || "Listing")}
              </Link>
              <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                <span>{role === "buyer" ? "Seller" : "Buyer"}</span>
                <span className="mx-1.5 text-border">·</span>
                <span className="font-medium text-foreground/90">{displayName(counterparty)}</span>
              </p>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "shrink-0 rounded-md px-2 py-px text-[11px] font-medium tracking-tight",
                statusBadgeClass(offer.status),
              )}
            >
              {statusLabel(offer.status)}
            </Badge>
          </div>

          <div className="mt-2.5 flex flex-wrap items-end gap-x-5 gap-y-2 border-t border-border/40 pt-2.5">
            {priceLines.map((line) => (
              <div
                key={line.label}
                className={cn(
                  "flex min-w-0 flex-col gap-0.5 tabular-nums",
                  line.emphasize && "rounded-md bg-muted/50 px-2 py-1 dark:bg-muted/25",
                )}
              >
                <span
                  className={cn(
                    "text-[11px] leading-none text-muted-foreground",
                    line.emphasize && "font-medium text-foreground/80",
                  )}
                >
                  {line.label}
                </span>
                <span
                  className={cn(
                    "text-sm font-medium text-foreground",
                    line.emphasize && "text-base font-semibold tracking-tight",
                  )}
                >
                  {line.value}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3 shrink-0 opacity-65" aria-hidden />
              Updated {formatDistanceToNow(new Date(offer.updated_at), { addSuffix: true })}
            </span>
            <span className="hidden h-2.5 w-px bg-border sm:block" aria-hidden />
            <span className="inline-flex items-center gap-1">
              <Timer className="h-3 w-3 shrink-0 opacity-65" aria-hidden />
              Expires {formatDistanceToNow(new Date(offer.expires_at), { addSuffix: true })}
            </span>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-border/40 pt-2.5">
            <Button
              variant="outline"
              size="sm"
              className="h-7 rounded-md border-border/70 px-2.5 text-[11px] font-medium"
              asChild
            >
              <Link href={href}>
                <ArrowUpRight className="h-3 w-3 opacity-75" aria-hidden />
                View listing
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 rounded-md border-border/70 px-2.5 text-[11px] font-medium"
              asChild
            >
              <Link href={messagesHref}>
                <MessageCircle className="h-3 w-3 opacity-75" aria-hidden />
                Messages
              </Link>
            </Button>
            {showViewCounter && (
              <Button
                size="sm"
                className="h-7 rounded-md px-3 text-[11px] font-semibold"
                type="button"
                onClick={() => onViewCounterOpen?.(offer)}
              >
                View counteroffer
              </Button>
            )}
            {showRespond && (
              <Button
                size="sm"
                className="h-7 rounded-md px-3 text-[11px] font-semibold"
                type="button"
                onClick={() => onRespondOpen(offer)}
              >
                Respond to offer
              </Button>
            )}
          </div>
        </div>
      </div>
    </article>
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
