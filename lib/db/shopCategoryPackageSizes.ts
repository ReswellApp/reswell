import type { SupabaseClient } from "@supabase/supabase-js"
import {
  parseShopCategoryPackageSizeMap,
  type ShopCategoryPackageSizeMap,
  type ShopPackageSizeId,
} from "@/lib/shop-category-package-sizes"
import type { PeerListingSection } from "@/lib/peer-listing-sections"

export type ListingsDeskProfile = {
  sellerSlug: string | null
  shopCategoryPackageSizes: ShopCategoryPackageSizeMap
}

function isMissingPackageColumn(message: string): boolean {
  return message.includes("shop_category_package_sizes")
}

export async function fetchListingsDeskProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<ListingsDeskProfile> {
  const withSizes = await supabase
    .from("profiles")
    .select("seller_slug, shop_category_package_sizes")
    .eq("id", userId)
    .maybeSingle()

  if (!withSizes.error && withSizes.data) {
    const slug = withSizes.data.seller_slug
    return {
      sellerSlug: typeof slug === "string" && slug.trim() ? slug.trim() : null,
      shopCategoryPackageSizes: parseShopCategoryPackageSizeMap(
        withSizes.data.shop_category_package_sizes,
      ),
    }
  }

  if (withSizes.error && !isMissingPackageColumn(withSizes.error.message)) {
    console.error("[fetchListingsDeskProfile]", withSizes.error.message)
  }

  const slugOnly = await supabase
    .from("profiles")
    .select("seller_slug")
    .eq("id", userId)
    .maybeSingle()

  if (slugOnly.error) {
    console.error("[fetchListingsDeskProfile] slug", slugOnly.error.message)
    return { sellerSlug: null, shopCategoryPackageSizes: {} }
  }

  const slug = slugOnly.data?.seller_slug
  return {
    sellerSlug: typeof slug === "string" && slug.trim() ? slug.trim() : null,
    shopCategoryPackageSizes: {},
  }
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
