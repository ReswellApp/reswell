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

/** Left accent on the details pane — subtle signal without loud UI chrome. */
function statusContentAccent(status: string): string {
  switch (status) {
    case "PENDING":
      return "border-l-amber-500/75 dark:border-l-amber-400/60"
    case "ACCEPTED":
    case "COMPLETED":
      return "border-l-emerald-600/70 dark:border-l-emerald-500/55"
    case "COUNTERED":
      return "border-l-sky-600/65 dark:border-l-sky-500/55"
    case "DECLINED":
    case "WITHDRAWN":
      return "border-l-neutral-400/70 dark:border-l-neutral-500/50"
    case "EXPIRED":
      return "border-l-neutral-500/60 dark:border-l-neutral-600/45"
    default:
      return "border-l-border"
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "PENDING":
      return "border-amber-200/90 bg-amber-500/[0.11] text-amber-950 dark:border-amber-500/35 dark:bg-amber-500/15 dark:text-amber-50"
    case "ACCEPTED":
    case "COMPLETED":
      return "border-emerald-200/90 bg-emerald-500/[0.11] text-emerald-950 dark:border-emerald-500/35 dark:bg-emerald-500/15 dark:text-emerald-50"
    case "COUNTERED":
      return "border-sky-200/90 bg-sky-500/[0.11] text-sky-950 dark:border-sky-500/35 dark:bg-sky-500/15 dark:text-sky-50"
    case "DECLINED":
    case "WITHDRAWN":
      return "border-border/80 bg-muted/50 text-muted-foreground"
    case "EXPIRED":
      return "border-border bg-muted/70 text-muted-foreground"
    default:
      return "border-border bg-muted/40 text-foreground"
  }
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
    <article
      className={cn(
        "group overflow-hidden rounded-2xl border border-border/70 bg-card/80 shadow-sm ring-1 ring-black/[0.03] transition-[border-color,box-shadow] duration-300 dark:bg-card/60 dark:ring-white/[0.06]",
        "hover:border-border hover:shadow-md",
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-stretch">
        <Link
          href={href}
          className="relative aspect-[5/4] w-full shrink-0 overflow-hidden bg-muted sm:aspect-auto sm:w-[152px] sm:min-h-[168px] lg:w-[168px]"
        >
          {img ? (
            <>
              <Image
                src={img}
                alt=""
                fill
                className="object-cover transition duration-500 ease-out group-hover:scale-[1.03]"
                sizes="(max-width: 640px) 100vw, 168px"
              />
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/[0.06] to-transparent sm:bg-gradient-to-r sm:from-transparent sm:to-black/[0.04]"
                aria-hidden
              />
            </>
          ) : (
            <div className="flex h-full min-h-[7rem] w-full items-center justify-center text-[11px] text-muted-foreground sm:min-h-0">
              No photo
            </div>
          )}
        </Link>

        <div
          className={cn(
            "flex min-w-0 flex-1 flex-col border-l-[3px] px-4 py-4 sm:px-5 sm:py-5",
            statusContentAccent(offer.status),
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Link
                href={href}
                className="line-clamp-2 text-[17px] font-semibold leading-snug tracking-tight text-foreground transition-colors hover:text-foreground/80"
              >
                {capitalizeWords(listingTitle || "Listing")}
              </Link>
              <p className="mt-1.5 text-[13px] leading-snug text-muted-foreground">
                <span className="text-muted-foreground/90">{role === "buyer" ? "Seller" : "Buyer"}</span>
                <span className="mx-1.5 text-border">·</span>
                <span className="font-medium text-foreground/95">{displayName(counterparty)}</span>
              </p>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-semibold tracking-tight",
                statusBadgeClass(offer.status),
              )}
            >
              {statusLabel(offer.status)}
            </Badge>
          </div>

          <div className="mt-4 rounded-xl border border-border/50 bg-muted/[0.35] p-3 dark:bg-muted/20">
            <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/90">
              Pricing
            </p>
            <dl className="space-y-2">
              {priceLines.map((line) => (
                <div
                  key={line.label}
                  className={cn(
                    "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 tabular-nums",
                    line.emphasize &&
                      "rounded-lg bg-background/90 px-2.5 py-2 shadow-sm ring-1 ring-border/45 dark:bg-background/35",
                  )}
                >
                  <dt
                    className={cn(
                      "text-[13px] text-muted-foreground",
                      line.emphasize && "font-medium text-foreground/85",
                    )}
                  >
                    {line.label}
                  </dt>
                  <dd
                    className={cn(
                      "text-right text-[15px] font-medium text-foreground",
                      line.emphasize && "text-[17px] font-semibold tracking-tight",
                    )}
                  >
                    {line.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
              Updated {formatDistanceToNow(new Date(offer.updated_at), { addSuffix: true })}
            </span>
            <span className="hidden h-3 w-px bg-border sm:block" aria-hidden />
            <span className="inline-flex items-center gap-1.5">
              <Timer className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
              Expires {formatDistanceToNow(new Date(offer.expires_at), { addSuffix: true })}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/50 pt-4">
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-full border-border/80 px-3.5 text-xs font-medium"
              asChild
            >
              <Link href={href}>
                <ArrowUpRight className="h-3.5 w-3.5 opacity-80" aria-hidden />
                View listing
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-full border-border/80 px-3.5 text-xs font-medium"
              asChild
            >
              <Link href={messagesHref}>
                <MessageCircle className="h-3.5 w-3.5 opacity-80" aria-hidden />
                Messages
              </Link>
            </Button>
            {showViewCounter && (
              <Button
                size="sm"
                className="h-8 rounded-full px-4 text-xs font-semibold"
                type="button"
                onClick={() => onViewCounterOpen?.(offer)}
              >
                View counteroffer
              </Button>
            )}
            {showRespond && (
              <Button
                size="sm"
                className="h-8 rounded-full px-4 text-xs font-semibold"
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
