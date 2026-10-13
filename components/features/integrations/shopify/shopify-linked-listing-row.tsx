"use client"

import Image from "next/image"
import { PackageOpen } from "lucide-react"
import { formatDistanceToNowLabel, RelativeTime } from "@/components/ui/relative-time"
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-sm font-medium tabular-nums text-foreground">
        {children}
      </dd>
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
  return (
    <li
      className={cn(
        "flex gap-3 rounded-xl border bg-card p-3 sm:gap-4 sm:p-4",
        flagged && "border-red-200 dark:border-red-900",
      )}
    >
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted sm:h-20 sm:w-20">
        {listing.imageUrl ? (
          <Image
            src={listing.imageUrl}
            alt=""
            fill
            className="object-cover"
            sizes="80px"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <PackageOpen className="h-6 w-6" aria-hidden />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate font-semibold text-foreground">
                {listing.title}
              </h3>
              <ShopifyListingStateBadge state={listing.state} />
            </div>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {listing.variantTitle ?? "Single variant"} ·{" "}
              {PEER_LISTING_SECTION_LABELS[listing.section]}
            </p>
          </div>
          <ShopifyLinkedListingActions
            listing={listing}
            busy={busy}
            canSync={canSync}
            onResync={onResync}
            onUnpublish={onUnpublish}
          />
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
          <Field label="Price">
            {listing.price != null ? currency.format(listing.price) : "—"}
          </Field>
          <Field label="Shopify qty">
            {listing.shopifyQuantity ?? (listing.state === "needs_removal" ? "Gone" : "—")}
          </Field>
          <Field label="Reswell">
            {RESWELL_STATUS_LABELS[listing.reswellStatus] ?? listing.reswellStatus}
            {listing.reswellStatus === "active" ? ` · ${listing.reswellStock} in stock` : ""}
          </Field>
          <Field label="Last sync">
            {listing.lastSyncedAt ? (
              <RelativeTime
                iso={listing.lastSyncedAt}
                formatLabel={formatDistanceToNowLabel}
                placeholder="—"
              />
            ) : (
              "Never"
            )}
          </Field>
        </dl>

        {listing.state === "needs_removal" ? (
          <p className="text-xs text-red-700 dark:text-red-300">
            Shopify no longer has this variant. Reswell removes it on the next
            sync, or right away with Sync now.
          </p>
        ) : null}
      </div>
    </li>
  )
}
