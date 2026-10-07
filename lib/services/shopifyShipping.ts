import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchProfileAddresses } from "@/lib/db/profile-addresses"
import { fetchListingsDeskProfile } from "@/lib/db/shopCategoryPackageSizes"
import {
  PEER_LISTING_SECTION_LABELS,
  type PeerListingSection,
} from "@/lib/peer-listing-sections"
import {
  listingPackageColumnsForShopSize,
  shopPackageSizeLabel,
  shopPackageSizeSummary,
  type ListingPackageColumns,
  type ShopCategoryPackageSizeMap,
} from "@/lib/shop-category-package-sizes"
import type { ShopifyShippingReadiness } from "@/lib/shopify/types"

export type ShopifyImportFulfillmentDefaults = {
  local_pickup: true
  shipping_available: boolean
  shipping_price: null
  board_shipping_cost_mode: "reswell" | null
} & Partial<ListingPackageColumns>

export function shopifyImportFulfillmentDefaults(input: {
  section: PeerListingSection
  hasShipFromAddress: boolean
  packageSizes: ShopCategoryPackageSizeMap
}): ShopifyImportFulfillmentDefaults {
  const packageSizeId = input.packageSizes[input.section]
  const packageColumns = packageSizeId
    ? listingPackageColumnsForShopSize(input.section, packageSizeId)
    : null
  const shippingAvailable =
    input.hasShipFromAddress && packageColumns !== null

  return {
    local_pickup: true,
    shipping_available: shippingAvailable,
    shipping_price: null,
    board_shipping_cost_mode: shippingAvailable ? "reswell" : null,
    ...(packageColumns ?? {}),
  }
}

export async function getShopifyShippingReadiness(
  supabase: SupabaseClient,
  userId: string,
): Promise<
  ShopifyShippingReadiness & { packageSizes: ShopCategoryPackageSizeMap }
> {
  const [profile, addresses] = await Promise.all([
    fetchListingsDeskProfile(supabase, userId),
    fetchProfileAddresses(supabase, userId),
  ])
  const packageDefaults: ShopifyShippingReadiness["packageDefaults"] = []
  for (const [section, packageSizeId] of Object.entries(
    profile.shopCategoryPackageSizes,
  )) {
    if (!packageSizeId) continue
    const typedSection = section as PeerListingSection
    packageDefaults.push({
      section: typedSection,
      sectionLabel: PEER_LISTING_SECTION_LABELS[typedSection],
      packageSizeId,
      packageLabel: shopPackageSizeLabel(packageSizeId),
      packageSummary: shopPackageSizeSummary(packageSizeId),
    })
  }
  packageDefaults.sort((left, right) =>
    left.sectionLabel.localeCompare(right.sectionLabel),
  )

  return {
    hasShipFromAddress: addresses.addresses.length > 0,
    packageDefaults,
    packageSizes: profile.shopCategoryPackageSizes,
  }
}
