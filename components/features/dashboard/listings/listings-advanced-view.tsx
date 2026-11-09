"use client"

import { ListingDeskTable } from "@/components/features/dashboard/listings/listing-desk-table"
import { ListingsAdvancedAnalytics } from "@/components/features/dashboard/listings/listings-advanced-analytics"
import { ListingsAdvancedTools } from "@/components/features/dashboard/listings/listings-advanced-tools"
import { ShopCategoryPackagePanel } from "@/components/features/dashboard/listings/shop-category-package-panel"
import type { ListingQuickEditSaved } from "@/lib/services/listingQuickEdit"
import type { ListingsDeskAnalyticsInput } from "@/lib/listings-desk-analytics"
import type { ListingPackageColumns, ShopPackageSizeId } from "@/lib/shop-category-package-sizes"
import type { ShopShippingDefaults } from "@/lib/shop-shipping-defaults"

type DeskListing = ListingsDeskAnalyticsInput & {
  slug: string | null
  condition: string | null
  description: string | null
  archived_at: string | null
  inventory_source: string
  site_visibility_reason: string | null
  canDelete: boolean
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
  shopShippingDefaults: ShopShippingDefaults
  listedSort: "recent" | "oldest"
  onListedSortChange: (sort: "recent" | "oldest") => void
  onListingSaved: (listingId: string, saved: ListingQuickEditSaved) => void
  onShippingApplied: (groups: { ids: string[]; columns: ListingPackageColumns }[]) => void
  onEndListing: (listingId: string) => void
  onDiscardDraft?: (listingId: string) => void
  packageSyncById?: Record<string, { sizeId: ShopPackageSizeId; nonce: number }>
}

export function ListingsAdvancedView({
  allListings,
  visibleListings,
  sellerStoreHref,
  sellerBanned,
  shopShippingDefaults,
  listedSort,
  onListedSortChange,
  onListingSaved,
  onShippingApplied,
  onEndListing,
  onDiscardDraft,
  packageSyncById,
}: ListingsAdvancedViewProps) {
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
        shippingDefaults={shopShippingDefaults}
        onShippingApplied={onShippingApplied}
      />
      <ListingDeskTable
        listings={visibleListings}
        listedSort={listedSort}
        onListedSortChange={onListedSortChange}
        onListingSaved={onListingSaved}
        onEndListing={onEndListing}
        onDiscardDraft={onDiscardDraft}
        packageSyncById={packageSyncById}
      />
    </div>
  )
}
