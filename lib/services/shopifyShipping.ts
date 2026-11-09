import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchProfileAddresses } from "@/lib/db/profile-addresses"
import { dbLoadShopifyImportShippingProfile } from "@/lib/db/shopifyCatalog"
import { fetchListingsDeskProfile } from "@/lib/db/shopCategoryPackageSizes"
import { saveShopifyDefaultPackageIfMissing } from "@/lib/services/shopifyDefaultPackage"
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
import {
  SHOP_STORE_DEFAULT_ID,
  formatShopPackedSizeSummary,
  packageFitsSurfboardListing,
  shopShippingColumnsForRef,
  shopShippingColumnsForSoftSection,
  type ShopShippingDefaults,
} from "@/lib/shop-shipping-defaults"
import type { ShopifyShippingReadiness } from "@/lib/shopify/types"

async function shopDefaultsWithShopifyPackage(
  supabase: SupabaseClient,
  userId: string,
  current: ShopShippingDefaults,
): Promise<ShopShippingDefaults> {
  if (current.storeDefault) return current
  try {
    // OAuth is only needed when Shopify might fill an empty shop box.
    const [{ createServiceRoleClient }, { dbGetShopifyConnectionForUser }, { getShopifyAccessToken }] =
      await Promise.all([
        import("@/lib/supabase/server"),
        import("@/lib/db/shopifyConnections"),
        import("@/lib/services/shopifyOAuth"),
      ])
    const service = createServiceRoleClient()
    const connection = await dbGetShopifyConnectionForUser(service, userId)
    if (!connection || connection.status !== "active") return current
    return await saveShopifyDefaultPackageIfMissing({
      supabase,
      userId,
      shopDomain: connection.shop_domain,
      accessToken: await getShopifyAccessToken(service, connection),
      current,
    })
  } catch (error) {
    console.error("[shopifyDefaultPackage] readiness", {
      userId,
      timestamp: new Date().toISOString(),
      message:
        error instanceof Error
          ? error.message
          : "Could not read Shopify's default package",
    })
    return current
  }
}

export type ShopifyImportFulfillmentDefaults = {
  local_pickup: true
  shipping_available: boolean
  shipping_price: null
  board_shipping_cost_mode: "reswell" | null
} & Partial<ListingPackageColumns>

function shopDefaultColumnsForImport(
  section: PeerListingSection,
  packageSizes: ShopCategoryPackageSizeMap,
  shippingDefaults: ShopShippingDefaults | undefined,
): ListingPackageColumns | null {
  if (!shippingDefaults?.physicalProduct) return null
  if (section === "surfboards") {
    const ref = shippingDefaults.boardSizes.shortboard_medium ?? SHOP_STORE_DEFAULT_ID
    const columns = shopShippingColumnsForRef(shippingDefaults, ref, "shortboard_medium")
    return columns && packageFitsSurfboardListing(columns) ? columns : null
  }
  if (packageSizes[section]) return null
  return shopShippingColumnsForSoftSection(shippingDefaults, section)
}

export function shopifyImportFulfillmentDefaults(input: {
  section: PeerListingSection
  hasShipFromAddress: boolean
  packageSizes: ShopCategoryPackageSizeMap
  shippingDefaults?: ShopShippingDefaults
}): ShopifyImportFulfillmentDefaults {
  const packageSizeId = input.packageSizes[input.section]
  const packageColumns =
    shopDefaultColumnsForImport(input.section, input.packageSizes, input.shippingDefaults) ??
    (packageSizeId ? listingPackageColumnsForShopSize(input.section, packageSizeId) : null)
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

export async function getShopifyImportFulfillmentDefaults(
  supabase: SupabaseClient,
  userId: string,
  section: PeerListingSection,
): Promise<ShopifyImportFulfillmentDefaults> {
  const profile = await dbLoadShopifyImportShippingProfile(
    supabase,
    userId,
  )
  return shopifyImportFulfillmentDefaults({
    section,
    hasShipFromAddress: profile.hasShipFromAddress,
    packageSizes: profile.packageSizes,
    shippingDefaults: profile.shippingDefaults,
  })
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
  const shippingDefaults = await shopDefaultsWithShopifyPackage(
    supabase,
    userId,
    profile.shopShippingDefaults,
  )
  const packageDefaults: ShopifyShippingReadiness["packageDefaults"] = []
  const storeDefault = shippingDefaults.storeDefault
  if (shippingDefaults.physicalProduct && storeDefault) {
    packageDefaults.push({
      section: "surfboards",
      sectionLabel: "Shop default",
      packageSizeId: SHOP_STORE_DEFAULT_ID,
      packageLabel: storeDefault.name,
      packageSummary: formatShopPackedSizeSummary(storeDefault),
    })
  }
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
