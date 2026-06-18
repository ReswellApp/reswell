import type { SupabaseClient } from "@supabase/supabase-js"
import type { ShopifyConnectionRow } from "@/lib/shopify/types"

const CONNECTION_SELECT =
  "id, user_id, shop_domain, access_token, scopes, status, shop_name, connected_at, disconnected_at, last_sync_at, last_error, api_version, installed_via, uninstalled_at, webhook_last_received_at, sync_mode, sync_collection_ids, sync_tags, auto_sync_enabled, pricing_mode, markup_percent, default_condition, last_full_sync_at" as const

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

export async function getShopifyConnectionById(
  supabase: SupabaseClient,
  connectionId: string,
): Promise<ShopifyConnectionRow | null> {
  const { data, error } = await supabase
    .from("shopify_connections")
    .select(CONNECTION_SELECT)
    .eq("id", connectionId)
    .maybeSingle()

  if (error) throw new Error(error.message)
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

/**
 * App-uninstalled lifecycle: Shopify already revoked the token, so we mark the connection
 * uninstalled and pause its synced listings. Idempotent — safe to call on webhook retries.
 */
export async function markShopifyConnectionUninstalled(
  supabase: SupabaseClient,
  shopDomain: string,
): Promise<{ connectionId: string; userId: string } | null> {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from("shopify_connections")
    .update({
      status: "disconnected",
      uninstalled_at: now,
      disconnected_at: now,
      auto_sync_enabled: false,
      last_error: "App uninstalled from Shopify",
      updated_at: now,
    })
    .eq("shop_domain", shopDomain)
    .in("status", ["active", "error"])
    .select("id, user_id")
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  await supabase
    .from("listings")
    .update({ status: "removed", updated_at: now })
    .eq("user_id", data.user_id)
    .eq("listing_source", "shopify")
    .eq("sync_managed", true)

  return { connectionId: data.id as string, userId: data.user_id as string }
}

export async function updateShopifyConnectionSettings(
  supabase: SupabaseClient,
  connectionId: string,
  userId: string,
  settings: {
    sync_mode?: string
    sync_collection_ids?: string[]
    sync_tags?: string[]
    auto_sync_enabled?: boolean
    pricing_mode?: string
    markup_percent?: number
    default_condition?: string
  },
): Promise<void> {
  const { error } = await supabase
    .from("shopify_connections")
    .update({ ...settings, updated_at: new Date().toISOString() })
    .eq("id", connectionId)
    .eq("user_id", userId)

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
