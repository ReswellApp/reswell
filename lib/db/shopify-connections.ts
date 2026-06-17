import type { SupabaseClient } from "@supabase/supabase-js"
import type { ShopifyConnectionRow } from "@/lib/shopify/types"

const CONNECTION_SELECT =
  "id, user_id, shop_domain, access_token, scopes, status, shop_name, connected_at, disconnected_at, last_sync_at, last_error" as const

export async function getActiveShopifyConnectionForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<ShopifyConnectionRow | null> {
  const { data, error } = await supabase
    .from("shopify_connections")
    .select(CONNECTION_SELECT)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }
  return (data as ShopifyConnectionRow | null) ?? null
}

export async function getShopifyConnectionByShopDomain(
  supabase: SupabaseClient,
  shopDomain: string,
): Promise<ShopifyConnectionRow | null> {
  const { data, error } = await supabase
    .from("shopify_connections")
    .select(CONNECTION_SELECT)
    .eq("shop_domain", shopDomain)
    .eq("status", "active")
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }
  return (data as ShopifyConnectionRow | null) ?? null
}

export async function upsertShopifyConnection(
  supabase: SupabaseClient,
  row: {
    userId: string
    shopDomain: string
    accessToken: string
    scopes: string
    shopName: string | null
  },
): Promise<ShopifyConnectionRow> {
  const now = new Date().toISOString()

  const { data: existing } = await supabase
    .from("shopify_connections")
    .select("id")
    .eq("user_id", row.userId)
    .eq("status", "active")
    .maybeSingle()

  if (existing?.id) {
    const { data, error } = await supabase
      .from("shopify_connections")
      .update({
        shop_domain: row.shopDomain,
        access_token: row.accessToken,
        scopes: row.scopes,
        shop_name: row.shopName,
        status: "active",
        disconnected_at: null,
        last_error: null,
        updated_at: now,
      })
      .eq("id", existing.id)
      .select(CONNECTION_SELECT)
      .single()

    if (error || !data) throw new Error(error?.message ?? "Failed to update Shopify connection")
    return data as ShopifyConnectionRow
  }

  const { data, error } = await supabase
    .from("shopify_connections")
    .insert({
      user_id: row.userId,
      shop_domain: row.shopDomain,
      access_token: row.accessToken,
      scopes: row.scopes,
      shop_name: row.shopName,
      status: "active",
      connected_at: now,
      updated_at: now,
    })
    .select(CONNECTION_SELECT)
    .single()

  if (error || !data) throw new Error(error?.message ?? "Failed to create Shopify connection")
  return data as ShopifyConnectionRow
}

export async function disconnectShopifyConnection(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await supabase
    .from("shopify_connections")
    .update({
      status: "disconnected",
      disconnected_at: now,
      updated_at: now,
    })
    .eq("user_id", userId)
    .eq("status", "active")

  if (error) throw new Error(error.message)
}

export async function markShopifyConnectionSync(
  supabase: SupabaseClient,
  connectionId: string,
  errorMessage?: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("shopify_connections")
    .update({
      last_sync_at: new Date().toISOString(),
      last_error: errorMessage ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connectionId)

  if (error) throw new Error(error.message)
}

export type ShopifyConnectionPublic = Omit<ShopifyConnectionRow, "access_token">

export function toPublicShopifyConnection(row: ShopifyConnectionRow): ShopifyConnectionPublic {
  const { access_token: _token, ...rest } = row
  return rest
}
