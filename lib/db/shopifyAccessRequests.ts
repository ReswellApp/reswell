import type { SupabaseClient } from "@supabase/supabase-js"

export async function dbGetShopifyAccessRequestState(
  supabase: SupabaseClient,
  userId: string,
): Promise<{
  shopifyConnectEnabled: boolean
  requestedAt: string | null
}> {
  const { data, error } = await supabase
    .from("profiles")
    .select("shopify_connect_enabled, shopify_connect_requested_at")
    .eq("id", userId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return {
    shopifyConnectEnabled: data?.shopify_connect_enabled === true,
    requestedAt:
      typeof data?.shopify_connect_requested_at === "string"
        ? data.shopify_connect_requested_at
        : null,
  }
}

export async function dbInsertShopifyAccessRequest(
  supabase: SupabaseClient,
  input: {
    userId: string
    shopDomain: string | null
    shopName: string | null
  },
): Promise<"inserted" | "already_pending"> {
  const { error } = await supabase.from("shopify_access_requests").insert({
    user_id: input.userId,
    shop_domain: input.shopDomain,
    shop_name: input.shopName,
    status: "pending",
  })
  if (!error) return "inserted"
  if (error.code === "23505") return "already_pending"
  throw new Error(error.message)
}

export async function dbMarkShopifyConnectRequested(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({
      shopify_connect_requested_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .is("shopify_connect_requested_at", null)
  if (error) throw new Error(error.message)
}

export async function dbMarkPendingShopifyAccessRequestsGranted(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from("shopify_access_requests")
    .update({
      status: "granted",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("status", "pending")
  if (error) throw new Error(error.message)
}
