"use client"

import { useState } from "react"
import { ListingInlineEditor } from "@/components/features/dashboard/listings/listing-inline-editor"
import { ListingsAdvancedAnalytics } from "@/components/features/dashboard/listings/listings-advanced-analytics"
import { ListingsAdvancedTools } from "@/components/features/dashboard/listings/listings-advanced-tools"
import { ShopCategoryPackagePanel } from "@/components/features/dashboard/listings/shop-category-package-panel"
import type { ListingQuickEditSaved } from "@/lib/actions/listingQuickEdit"
import type { ListingsDeskAnalyticsInput } from "@/lib/listings-desk-analytics"
import {
  type ListingPackageColumns,
  type ShopCategoryPackageSizeMap,
  type ShopPackageSizeId,
} from "@/lib/shop-category-package-sizes"

type DeskListing = ListingsDeskAnalyticsInput & {
  slug: string | null
  condition: string | null
  description: string | null
  archived_at: string | null
  inventory_source: string
  site_visibility_reason: string | null
  listing_images: { url: string; thumbnail_url?: string | null; is_primary: boolean | null }[] | null
  shipping_package_tier: string | null
  shipping_package_band: string | null
  shipping_packed_length_in: number | null
  shipping_packed_width_in: number | null
  shipping_packed_height_in: number | null
  shipping_packed_weight_oz: number | null
  brand: string | null
  model: string | null
  city: string | null
  state: string | null
  latitude: number | null
  longitude: number | null
  local_pickup: boolean | null
  shipping_available: boolean | null
  board_shipping_cost_mode: string | null
  shipping_price: number | null
  dropoff_location_id: string | null
  dimensions: string | null
  length_total_inches: number | null
  volume_liters: number | null
  fins_setup: string | null
  fin_system: string | null
  construction: string | null
  fins_included: boolean | null
  tail_shape: string | null
  fin_size: string | null
  wetsuit_size: string | null
  apparel_kind: string | null
  traction_size: string | null
}

interface ListingsAdvancedViewProps {
  allListings: DeskListing[]
  visibleListings: DeskListing[]
  sellerStoreHref: string | null
  sellerBanned: boolean
  shopCategoryPackageSizes: ShopCategoryPackageSizeMap
  onListingSaved: (listingId: string, saved: ListingQuickEditSaved) => void
  onPackageApplied: (section: string, columns: ListingPackageColumns) => void
}

export function ListingsAdvancedView({
  allListings,
  visibleListings,
  sellerStoreHref,
  sellerBanned,
  shopCategoryPackageSizes,
  onListingSaved,
  onPackageApplied,
}: ListingsAdvancedViewProps) {
  const [packageSync, setPackageSync] = useState<{
    nonce: number
    section: string
    packageSizeId: ShopPackageSizeId
  } | null>(null)
  const [openEditorId, setOpenEditorId] = useState<string | null>(null)

  return (
    <div
      id="listings-view-panel-advanced"
      role="tabpanel"
      aria-labelledby="listings-view-advanced"
      className="space-y-8"
    >
      <ListingsAdvancedAnalytics listings={allListings} />
      <ListingsAdvancedTools sellerStoreHref={sellerStoreHref} sellerBanned={sellerBanned} />
      <ShopCategoryPackagePanel
        sizes={shopCategoryPackageSizes}
        listings={allListings}
        onApplied={(result) => {
          setPackageSync((current) => ({
            nonce: (current?.nonce ?? 0) + 1,
            section: result.section,
            packageSizeId: result.packageSizeId,
          }))
          onPackageApplied(result.section, result.columns)
        }}
      />
      <section className="space-y-3" aria-labelledby="listings-editor-heading">
        <div>
          <h2 id="listings-editor-heading" className="text-base font-semibold text-foreground">
            Edit listings
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Title and price save as you type. Open a listing to edit shipping, condition, and the rest of it. Photo changes use the full editor.
          </p>
        </div>
        {visibleListings.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
            No listings match this view.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
            <div className="divide-y divide-border/60">
              {visibleListings.map((listing) => (
                <ListingInlineEditor
                  key={listing.id}
                  listing={listing}
                  expanded={openEditorId === listing.id}
                  onExpandedChange={(open) => setOpenEditorId(open ? listing.id : null)}
                  appliedPackageSizeId={
                    packageSync?.section === listing.section &&
                    listing.inventory_source !== "shopify"
                      ? packageSync.packageSizeId
                      : null
                  }
                  packageSyncNonce={
                    packageSync?.section === listing.section &&
                    listing.inventory_source !== "shopify"
                      ? packageSync.nonce
                      : 0
                  }
                  onSaved={onListingSaved}
                />
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
