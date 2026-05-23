"use client"

import Link from "next/link"
import Image from "next/image"
import { formatDistanceToNow } from "date-fns"
import {
  ArrowUpRight,
  Clock,
  MessageCircle,
  Timer,
} from "lucide-react"
import { Button } from "@/components/ui/button"
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

/** Status pill on “I made” tiles — seller-opened negotiations read as “From seller”. */
export function buyerMadeOfferStatusLabel(offer: DashboardOfferRow): string {
  if (offer.status === "COUNTERED" && offer.seller_initiated) return "From seller"
  return statusLabel(offer.status)
}

export function counterOfferResponseExpired(offer: DashboardOfferRow): boolean {
  if (offer.status !== "COUNTERED") return false
  const t = new Date(offer.expires_at).getTime()
  return Number.isFinite(t) && t <= Date.now()
}

function displayName(p: DashboardProfileLite | undefined): string {
  if (!p) return "Member"
  if (p.is_shop && p.shop_name?.trim()) return p.shop_name.trim()
  return p.display_name?.trim() || "Member"
}

type PriceLine = { label: string; value: string; emphasize?: boolean }

export function offerTilePriceLines(
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
      if (offer.seller_initiated) {
        lines.push({
          label: "Seller's offer",
          value: `$${current}`,
          emphasize: true,
        })
        return lines
      }
      lines.push({ label: "Your offer", value: `$${initial}` })
      lines.push({ label: "Seller's counter", value: `$${current}`, emphasize: true })
      return lines
    }
    lines.push({ label: "Your offer", value: `$${current}`, emphasize: true })
    return lines
  }

  if (offer.status === "COUNTERED") {
    if (offer.seller_initiated) {
      lines.push({ label: "Your offer to buyer", value: `$${current}`, emphasize: true })
      return lines
    }
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

  if (initial !== current) {
    lines.push({ label: "Buyer offer (first)", value: `$${initial}` })
    lines.push({ label: "Last amount", value: `$${current}`, emphasize: true })
  } else {
    lines.push({ label: "Offer amount", value: `$${current}`, emphasize: true })
  }
  return lines
}

export function OfferRow({
  offer,
  role,
  counterparty,
  listingTitle,
  onRespondOpen,
  onViewCounterOpen,
  compact = false,
}: {
  offer: DashboardOfferRow
  role: "buyer" | "seller"
  counterparty: DashboardProfileLite | undefined
  listingTitle: string
  onRespondOpen: (o: DashboardOfferRow) => void
  onViewCounterOpen?: (o: DashboardOfferRow) => void
  /** Slightly tighter layout for the Messages offers tab. */
  compact?: boolean
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
    role === "buyer" &&
    offer.status === "COUNTERED" &&
    typeof onViewCounterOpen === "function" &&
    !counterOfferResponseExpired(offer)

  const listPriceKnown = !!listing && Number.isFinite(listPrice) && listPrice > 0
  const priceLines = offerTilePriceLines(role, offer, listPriceKnown, listPrice)

  return (
    <article
      className={cn(
        "group overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition-[border-color,box-shadow] duration-200 dark:bg-card/80",
        "hover:border-border/90 hover:shadow",
      )}
    >
      <div className={cn("flex flex-col sm:flex-row sm:items-stretch", compact && "sm:flex-row")}>
        <Link
          href={href}
          className={cn(
            "relative aspect-[3/4] w-full max-w-[13rem] shrink-0 overflow-hidden bg-muted sm:max-w-none",
            compact ? "sm:w-36" : "sm:w-52",
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

        <div className="flex min-w-0 flex-1 flex-col border-l-2 border-l-border px-3 py-3 sm:px-4 sm:py-3.5">
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
            <span className="shrink-0 rounded-full bg-muted/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground ring-1 ring-border/40">
              {role === "buyer" ? buyerMadeOfferStatusLabel(offer) : statusLabel(offer.status)}
            </span>
          </div>

          <div className="mt-2.5 flex flex-wrap items-start gap-x-5 gap-y-2 border-t border-border/40 pt-2.5">
            {priceLines.map((line) => (
              <div
                key={line.label}
                className={cn(
                  "flex min-w-0 flex-col gap-0.5 py-1 tabular-nums",
                  line.emphasize && "rounded-md bg-muted/50 px-2 dark:bg-muted/25",
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
                {offer.seller_initiated ? "Accept or decline" : "View counteroffer"}
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
