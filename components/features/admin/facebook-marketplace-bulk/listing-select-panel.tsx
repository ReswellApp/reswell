"use client"

import Image from "next/image"
import Link from "next/link"
import { ExternalLink, Loader2, Store, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { FACEBOOK_MARKETPLACE_BULK_UPLOAD_MAX } from "@/lib/facebook-marketplace/categories"
import { listingDetailHref } from "@/lib/listing-href"
import { formatCondition } from "@/lib/listing-labels"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import type { FacebookMarketplaceBulkListingPreview } from "@/lib/services/facebookMarketplaceBulkExport"

function sellerLabel(shopName: string | null | undefined, displayName: string | null | undefined): string {
  return shopName?.trim() || displayName?.trim() || "Seller"
}

function formatUsd(price: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(price)
}

type FacebookMarketplaceListingSelectPanelProps = {
  seller: {
    seller_slug: string
    display_name: string | null
    shop_name: string | null
  } | null
  listings: FacebookMarketplaceBulkListingPreview[]
  skipped: number
  loading: boolean
  selectedIds: Set<string>
  allVisibleSelected: boolean
  onToggleListing: (id: string, next: boolean) => void
  onSelectAll: () => void
  onClearSelection: () => void
  onClearSeller: () => void
}

export function FacebookMarketplaceListingSelectPanel({
  seller,
  listings,
  skipped,
  loading,
  selectedIds,
  allVisibleSelected,
  onToggleListing,
  onSelectAll,
  onClearSelection,
  onClearSeller,
}: FacebookMarketplaceListingSelectPanelProps) {
  const overLimit = listings.length > FACEBOOK_MARKETPLACE_BULK_UPLOAD_MAX

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">2. Choose listings</h2>
          {seller ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {sellerLabel(seller.shop_name, seller.display_name)} ·{" "}
              <Link
                href={`/sellers/${encodeURIComponent(seller.seller_slug)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 underline underline-offset-2"
              >
                View profile
                <ExternalLink className="h-3 w-3" />
              </Link>
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-muted-foreground">Select a seller to load their active listings.</p>
          )}
        </div>
        {seller ? (
          <Button type="button" variant="ghost" size="sm" onClick={onClearSeller}>
            <X className="mr-1.5 h-3.5 w-3.5" />
            Clear seller
          </Button>
        ) : null}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !seller ? (
        <div className="mt-6 flex flex-col items-center gap-2 rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 py-12 text-center">
          <Store className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No seller selected yet.</p>
        </div>
      ) : listings.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
          This seller has no active listings to export.
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {selectedIds.size} of {listings.length} selected
              {overLimit ? ` · first ${FACEBOOK_MARKETPLACE_BULK_UPLOAD_MAX} auto-selected` : ""}
              {skipped > 0 ? ` · ${skipped} skipped (missing price/title)` : ""}
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onSelectAll} disabled={allVisibleSelected}>
                Select {overLimit ? `first ${FACEBOOK_MARKETPLACE_BULK_UPLOAD_MAX}` : "all"}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={onClearSelection} disabled={selectedIds.size === 0}>
                Clear
              </Button>
            </div>
          </div>
          <ul className="mt-3 divide-y divide-border/60 overflow-hidden rounded-lg border border-border/70">
            {listings.map((listing) => {
              const checked = selectedIds.has(listing.id)
              const href = listingDetailHref({
                id: listing.id,
                slug: listing.slug,
                section: listing.section,
              })
              return (
                <li key={listing.id} className="flex items-center gap-3 px-3 py-2.5">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(value) => onToggleListing(listing.id, value === true)}
                    aria-label={`Select ${listing.title}`}
                  />
                  {listing.thumbnail_url ? (
                    <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-border/50 bg-muted">
                      <Image
                        src={listing.thumbnail_url}
                        alt=""
                        fill
                        sizes="48px"
                        className="object-cover"
                        unoptimized={listingImageShouldBypassOptimization(listing.thumbnail_url)}
                      />
                    </span>
                  ) : (
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-border/50 bg-muted text-[10px] text-muted-foreground">
                      No photo
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <Link
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="line-clamp-1 text-sm font-medium text-foreground hover:underline"
                    >
                      {listing.title}
                    </Link>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {formatUsd(listing.facebook.price)} · {listing.facebook.condition} · {listing.section_label}
                      {listing.condition ? ` (${formatCondition(listing.condition)})` : ""}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}
