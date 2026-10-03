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
  site_visibility_reason: string | null
  listing_images: { url: string; thumbnail_url?: string | null; is_primary: boolean | null }[] | null
  shipping_package_tier: string | null
  shipping_package_band: string | null
  shipping_packed_length_in: number | null
  shipping_packed_width_in: number | null
  shipping_packed_height_in: number | null
  shipping_packed_weight_oz: number | null
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
          <p className="mt-1 text-sm text-muted-foreground">
            Changes save automatically. Photos and shipping method still use the full editor.
          </p>
        </div>
        {visibleListings.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
            No listings match this view.
          </p>
        ) : (
          <div className="space-y-3">
            {visibleListings.map((listing) => (
              <ListingInlineEditor
                key={listing.id}
                listing={listing}
                appliedPackageSizeId={
                  packageSync?.section === listing.section ? packageSync.packageSizeId : null
                }
                packageSyncNonce={packageSync?.section === listing.section ? packageSync.nonce : 0}
                onSaved={onListingSaved}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
