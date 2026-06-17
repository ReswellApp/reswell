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
    .select("shopify_connect_enabled, is_admin")
    .eq("id", userId)
    .maybeSingle()

  if (error) {
    return { allowed: false, reason: "Could not verify access" }
  }

  const isAdmin = profile?.is_admin === true
  if (isAdmin || profile?.shopify_connect_enabled === true) {
    return { allowed: true, isAdmin }
  }

  return {
    allowed: false,
    reason: "Shopify integration is not enabled for your account. Contact Reswell to get access.",
  }
}
