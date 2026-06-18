import type { SupabaseClient } from "@supabase/supabase-js"

export type ShopifyAccessCheck =
  | { allowed: true; isAdmin: boolean }
  | { allowed: false; reason: string }

export async function checkShopifyConnectAccess(
  supabase: SupabaseClient,
  userId: string,
): Promise<ShopifyAccessCheck> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("shopify_connect_enabled, is_admin, is_shop, shop_verified")
    .eq("id", userId)
    .maybeSingle()

  if (error) {
    return { allowed: false, reason: "Could not verify access" }
  }

  const isAdmin = profile?.is_admin === true
  const verifiedShop = profile?.is_shop === true && profile?.shop_verified === true
  if (isAdmin || profile?.shopify_connect_enabled === true || verifiedShop) {
    return { allowed: true, isAdmin }
  }

  return {
    allowed: false,
    reason: "Connect Shopify from a verified Reswell shop account, or contact us to enable the integration.",
  }
}
