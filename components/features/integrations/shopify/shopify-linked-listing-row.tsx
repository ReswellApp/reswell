"use client"

import Image from "next/image"
import { formatDistanceToNowLabel, RelativeTime } from "@/components/ui/relative-time"
import {
  shopifyDividerClass,
  shopifyIndexRowClass,
  shopifyMutedClass,
  shopifyThumbClass,
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

function SyncTime({ iso }: { iso: string | null }) {
  if (!iso) return <>Never</>
  return (
    <RelativeTime iso={iso} formatLabel={formatDistanceToNowLabel} placeholder="—" />
  )
}

function ProductThumb({ listing }: { listing: ShopifyLinkedListing }) {
  return (
    <div className={shopifyThumbClass}>
      {listing.imageUrl ? (
        <Image
          src={listing.imageUrl}
          alt=""
          fill
          className="object-cover"
          sizes="40px"
        />
      ) : null}
    </div>
  )
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
  const subtitle = [
    listing.variantTitle ?? "Single variant",
    PEER_LISTING_SECTION_LABELS[listing.section],
    price,
  ].join(" · ")
  const actions = (
    <ShopifyLinkedListingActions
      listing={listing}
      busy={busy}
      canSync={canSync}
      onResync={onResync}
      onUnpublish={onUnpublish}
    />
  )

  return (
    <li
      className={cn(
        "border-b last:border-b-0",
        shopifyDividerClass,
        flagged && "bg-[#fff4f4] dark:bg-red-950/30",
      )}
    >
      <div className={cn("px-3 py-1.5 sm:px-4", shopifyIndexRowClass)}>
        <div className="flex min-w-0 items-center gap-3">
          <ProductThumb listing={listing} />
          <div className="min-w-0 flex-1">
            <h3 className="text-[13px] font-medium leading-4 text-[#303030] dark:text-foreground">
              {listing.title}
            </h3>
            <p className={`mt-0.5 text-[12px] leading-4 ${shopifyMutedClass}`}>
              {subtitle}
            </p>
            <div className="mt-1 md:hidden">
              <ShopifyListingStateBadge state={listing.state} />
            </div>
          </div>
          <div className="shrink-0 md:hidden">{actions}</div>
        </div>

        <div className="mt-2 hidden md:mt-0 md:block">
          <ShopifyListingStateBadge state={listing.state} />
        </div>

        <div className="mt-2 grid grid-cols-2 gap-3 md:mt-0 md:contents">
          <div className="min-w-0">
            <p className="text-[13px] leading-4 text-[#303030] dark:text-foreground">
              {shopifyQty} in Shopify
            </p>
            <p className={`text-[12px] leading-4 ${shopifyMutedClass}`}>
              {reswellLabel} on Reswell
              {listing.reswellStatus === "active" ? ` · ${listing.reswellStock} in stock` : ""}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-[13px] leading-4 text-[#303030] dark:text-foreground">
              <SyncTime iso={listing.lastSyncedAt} />
            </p>
          </div>
        </div>

        <div className="hidden justify-self-end md:block">{actions}</div>
      </div>

      {listing.state === "needs_removal" ? (
        <p className="px-3 pb-2 text-[12px] leading-4 text-[#8e1f0b] sm:px-4 dark:text-red-300">
          Shopify no longer has this variant. Reswell removes it on the next
          sync, or right away with Sync now.
        </p>
      ) : null}
    </li>
  )
}
