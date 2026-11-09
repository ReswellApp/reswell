import type { SupabaseClient } from "@supabase/supabase-js"
import {
  parseShopCategoryPackageSizeMap,
  type ShopCategoryPackageSizeMap,
  type ShopPackageSizeId,
} from "@/lib/shop-category-package-sizes"
import {
  EMPTY_SHOP_SHIPPING_DEFAULTS,
  readShopShippingDefaults,
  shopShippingDefaultsToJson,
  type ShopShippingDefaults,
} from "@/lib/shop-shipping-defaults"
import type { PeerListingSection } from "@/lib/peer-listing-sections"

export type ListingsDeskProfile = {
  sellerSlug: string | null
  shopCategoryPackageSizes: ShopCategoryPackageSizeMap
  shopShippingDefaults: ShopShippingDefaults
}

function isMissingPackageColumn(message: string): boolean {
  return message.includes("shop_category_package_sizes")
}

function isMissingShippingColumn(message: string): boolean {
  return message.includes("shop_shipping_defaults")
}

function emptyDeskProfile(sellerSlug: string | null): ListingsDeskProfile {
  return {
    sellerSlug,
    shopCategoryPackageSizes: {},
    shopShippingDefaults: { ...EMPTY_SHOP_SHIPPING_DEFAULTS, savedPackages: [], boardSizes: {} },
  }
}

export async function fetchListingsDeskProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<ListingsDeskProfile> {
  const withSizes = await supabase
    .from("profiles")
    .select("seller_slug, shop_category_package_sizes, shop_shipping_defaults")
    .eq("id", userId)
    .maybeSingle()

  if (!withSizes.error && withSizes.data) {
    const slug = withSizes.data.seller_slug
    return {
      sellerSlug: typeof slug === "string" && slug.trim() ? slug.trim() : null,
      shopCategoryPackageSizes: parseShopCategoryPackageSizeMap(
        withSizes.data.shop_category_package_sizes,
      ),
      shopShippingDefaults: readShopShippingDefaults(withSizes.data.shop_shipping_defaults),
    }
  }

  if (
    withSizes.error &&
    isMissingShippingColumn(withSizes.error.message) &&
    !isMissingPackageColumn(withSizes.error.message)
  ) {
    const packageOnly = await supabase
      .from("profiles")
      .select("seller_slug, shop_category_package_sizes")
      .eq("id", userId)
      .maybeSingle()
    if (!packageOnly.error && packageOnly.data) {
      const slug = packageOnly.data.seller_slug
      return {
        sellerSlug: typeof slug === "string" && slug.trim() ? slug.trim() : null,
        shopCategoryPackageSizes: parseShopCategoryPackageSizeMap(
          packageOnly.data.shop_category_package_sizes,
        ),
        shopShippingDefaults: { ...EMPTY_SHOP_SHIPPING_DEFAULTS, savedPackages: [], boardSizes: {} },
      }
    }
  }

  if (withSizes.error && !isMissingPackageColumn(withSizes.error.message) && !isMissingShippingColumn(withSizes.error.message)) {
    console.error("[fetchListingsDeskProfile]", withSizes.error.message)
  }

  const slugOnly = await supabase
    .from("profiles")
    .select("seller_slug")
    .eq("id", userId)
    .maybeSingle()

  if (slugOnly.error) {
    console.error("[fetchListingsDeskProfile] slug", slugOnly.error.message)
    return emptyDeskProfile(null)
  }

  const slug = slugOnly.data?.seller_slug
  return emptyDeskProfile(typeof slug === "string" && slug.trim() ? slug.trim() : null)
}

export async function saveShopShippingDefaults(
  supabase: SupabaseClient,
  userId: string,
  defaults: ShopShippingDefaults,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase
    .from("profiles")
    .update({ shop_shipping_defaults: shopShippingDefaultsToJson(defaults) })
    .eq("id", userId)

  if (error) {
    console.error("[saveShopShippingDefaults]", error.message)
    if (isMissingShippingColumn(error.message)) {
      return { ok: false, message: "Shop shipping isn't available yet. Try again shortly." }
    }
    return { ok: false, message: "Could not save your shop shipping default." }
  }

  return { ok: true }
}

export async function saveShopCategoryPackageSize(
  supabase: SupabaseClient,
  userId: string,
  section: PeerListingSection,
  packageSizeId: ShopPackageSizeId,
): Promise<{ ok: true; sizes: ShopCategoryPackageSizeMap } | { ok: false; message: string }> {
  const current = await fetchListingsDeskProfile(supabase, userId)
  const sizes: ShopCategoryPackageSizeMap = {
    ...current.shopCategoryPackageSizes,
    [section]: packageSizeId,
  }

  const { error } = await supabase
    .from("profiles")
    .update({ shop_category_package_sizes: sizes })
    .eq("id", userId)

  if (error) {
    console.error("[saveShopCategoryPackageSize]", error.message)
    if (isMissingPackageColumn(error.message)) {
      return { ok: false, message: "Package sizes are not available yet. Try again shortly." }
    }
    return { ok: false, message: "Could not save this package size." }
  }

  return { ok: true, sizes }
}
