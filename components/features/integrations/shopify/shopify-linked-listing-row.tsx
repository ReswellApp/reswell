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

function SyncTime({ iso }: { iso: string | null }) {
  if (!iso) return <>Never</>
  return (
    <RelativeTime iso={iso} formatLabel={formatDistanceToNowLabel} placeholder="—" />
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
        "block border-b px-4 py-4 last:border-b-0 sm:px-5",
        shopifyDividerClass,
        shopifyIndexGridClass,
        flagged && "bg-[#fff4f4] dark:bg-red-950/30",
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-[#e1e3e5] bg-[#f6f6f7] dark:border-border dark:bg-muted">
          {listing.imageUrl ? (
            <Image
              src={listing.imageUrl}
              alt=""
              fill
              className="object-cover"
              sizes="48px"
            />
          ) : (
            <div className={`flex h-full items-center justify-center ${shopifyMutedClass}`}>
              <PackageOpen className="h-5 w-5" aria-hidden />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-[14px] font-semibold leading-5 text-[#202223] dark:text-foreground">
                {listing.title}
              </h3>
              <p className={`mt-0.5 text-[13px] leading-5 ${shopifyMutedClass}`}>
                {listing.variantTitle ?? "Single variant"} ·{" "}
                {PEER_LISTING_SECTION_LABELS[listing.section]} · {price}
              </p>
            </div>
            <div className="shrink-0 md:hidden">{actions}</div>
          </div>
          <div className="mt-2 md:hidden">
            <ShopifyListingStateBadge state={listing.state} />
          </div>
        </div>
      </div>

      <div className="mt-3 hidden md:block">
        <ShopifyListingStateBadge state={listing.state} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 md:mt-0 md:contents">
        <div className="min-w-0">
          <p className={`text-[12px] leading-4 md:hidden ${shopifyMutedClass}`}>Inventory</p>
          <p className="text-[13px] leading-5 text-[#202223] dark:text-foreground">
            {shopifyQty} in Shopify
          </p>
          <p className={`text-[12px] leading-4 ${shopifyMutedClass}`}>
            {reswellLabel} on Reswell
            {listing.reswellStatus === "active" ? ` · ${listing.reswellStock} in stock` : ""}
          </p>
        </div>
        <div className="min-w-0">
          <p className={`text-[12px] leading-4 md:hidden ${shopifyMutedClass}`}>Sync</p>
          <p className="text-[13px] leading-5 text-[#202223] dark:text-foreground">
            <SyncTime iso={listing.lastSyncedAt} />
          </p>
        </div>
      </div>

      <div className="hidden justify-self-end md:block">{actions}</div>

      {listing.state === "needs_removal" ? (
        <p className="mt-2 text-[12px] leading-4 text-[#d72c0d] md:col-span-5 dark:text-red-300">
          Shopify no longer has this variant. Reswell removes it on the next
          sync, or right away with Sync now.
        </p>
      ) : null}
    </li>
  )
}
