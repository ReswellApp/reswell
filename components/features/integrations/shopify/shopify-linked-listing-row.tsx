"use client"

import Image from "next/image"
import { PackageOpen } from "lucide-react"
import { formatDistanceToNowLabel, RelativeTime } from "@/components/ui/relative-time"
import {
  shopifyDividerClass,
  shopifyIndexGridClass,
  shopifyMutedClass,
} from "@/components/features/integrations/shopify/shopify-admin-styles"
import { ShopifyLinkedListingActions } from "@/components/features/integrations/shopify/shopify-linked-listing-actions"
import { ShopifyListingStateBadge } from "@/components/features/integrations/shopify/shopify-listing-state-badge"
import { PEER_LISTING_SECTION_LABELS } from "@/lib/peer-listing-sections"
import type { ShopifyLinkedListing } from "@/lib/shopify/types"
import { cn } from "@/lib/utils"

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

const RESWELL_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  removed: "Removed",
  sold: "Sold",
  draft: "Draft",
}

interface ShopifyLinkedListingRowProps {
  listing: ShopifyLinkedListing
  busy: boolean
  canSync: boolean
  onResync: (productId: string) => void
  onUnpublish: (productId: string) => void
}

export function ShopifyLinkedListingRow({
  listing,
  busy,
  canSync,
  onResync,
  onUnpublish,
}: ShopifyLinkedListingRowProps) {
  const flagged = listing.state === "needs_removal" || listing.state === "error"
  const reswellLabel =
    RESWELL_STATUS_LABELS[listing.reswellStatus] ?? listing.reswellStatus
  const price = listing.price != null ? currency.format(listing.price) : "—"
  const shopifyQty =
    listing.shopifyQuantity ?? (listing.state === "needs_removal" ? "Gone" : "—")

  return (
    <li
      className={cn(
        "relative block border-b px-3 py-3 last:border-b-0",
        shopifyDividerClass,
        shopifyIndexGridClass,
        flagged && "bg-[#fff4f4] dark:bg-red-950/30",
      )}
    >
      <div className="flex min-w-0 gap-3 pr-8 sm:pr-0">
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md border border-[#e1e3e5] bg-[#f6f6f7] dark:border-border dark:bg-muted">
          {listing.imageUrl ? (
            <Image
              src={listing.imageUrl}
              alt=""
              fill
              className="object-cover"
              sizes="40px"
            />
          ) : (
            <div className={`flex h-full items-center justify-center ${shopifyMutedClass}`}>
              <PackageOpen className="h-4 w-4" aria-hidden />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-[13px] font-semibold leading-5 text-[#202223] dark:text-foreground">
            {listing.title}
          </h3>
          <p className={`truncate text-[12px] leading-4 ${shopifyMutedClass}`}>
            {listing.variantTitle ?? "Single variant"} ·{" "}
            {PEER_LISTING_SECTION_LABELS[listing.section]} · {price}
          </p>
          <div className="mt-1 sm:hidden">
            <ShopifyListingStateBadge state={listing.state} />
          </div>
        </div>
      </div>

      <div className="hidden sm:block">
        <ShopifyListingStateBadge state={listing.state} />
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 sm:contents">
        <div>
          <p className={`text-[12px] leading-4 sm:hidden ${shopifyMutedClass}`}>Stock</p>
          <p className="text-[13px] leading-5 text-[#202223] dark:text-foreground">
            Shopify {shopifyQty}
          </p>
          <p className={`text-[12px] leading-4 ${shopifyMutedClass}`}>
            Reswell {reswellLabel}
            {listing.reswellStatus === "active"
              ? ` · ${listing.reswellStock} in stock`
              : ""}
          </p>
        </div>
        <div>
          <p className={`text-[12px] leading-4 sm:hidden ${shopifyMutedClass}`}>Sync</p>
          <p className="text-[13px] leading-5 text-[#202223] dark:text-foreground">
            {listing.lastSyncedAt ? (
              <RelativeTime
                iso={listing.lastSyncedAt}
                formatLabel={formatDistanceToNowLabel}
                placeholder="—"
              />
            ) : (
              "Never"
            )}
          </p>
        </div>
      </div>

      <div className="absolute right-1 top-2 sm:static sm:justify-self-end">
        <ShopifyLinkedListingActions
          listing={listing}
          busy={busy}
          canSync={canSync}
          onResync={onResync}
          onUnpublish={onUnpublish}
        />
      </div>

      {listing.state === "needs_removal" ? (
        <p className="mt-2 text-[12px] leading-4 text-[#d72c0d] sm:col-span-5 dark:text-red-300">
          Shopify no longer has this variant. Reswell removes it on the next
          sync, or right away with Sync now.
        </p>
      ) : null}
    </li>
  )
}
