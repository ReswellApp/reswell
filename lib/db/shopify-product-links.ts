import type { SupabaseClient } from "@supabase/supabase-js"
import type { PeerListingSection } from "@/lib/peer-listing-sections"
import type { ShopifyProductLinkSyncStatus } from "@/lib/shopify/types"

export type ShopifyProductLinkRow = {
  id: string
  user_id: string
  connection_id: string
  listing_id: string
  shopify_product_id: string
  shopify_variant_id: string
  reswell_section: PeerListingSection
  sync_status: ShopifyProductLinkSyncStatus
  shopify_updated_at: string | null
  last_synced_at: string | null
  last_error: string | null
}

const LINK_SELECT =
  "id, user_id, connection_id, listing_id, shopify_product_id, shopify_variant_id, reswell_section, sync_status, shopify_updated_at, last_synced_at, last_error" as const

export async function getShopifyLinkByVariantId(
  supabase: SupabaseClient,
  connectionId: string,
  variantId: string,
): Promise<ShopifyProductLinkRow | null> {
  const { data, error } = await supabase
    .from("shopify_product_links")
    .select(LINK_SELECT)
    .eq("connection_id", connectionId)
    .eq("shopify_variant_id", variantId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return (data as ShopifyProductLinkRow | null) ?? null
}

export async function listShopifyLinksForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<ShopifyProductLinkRow[]> {
  const { data, error } = await supabase
    .from("shopify_product_links")
    .select(LINK_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)
  return (data as ShopifyProductLinkRow[]) ?? []
}

export async function upsertShopifyProductLink(
  supabase: SupabaseClient,
  row: {
    userId: string
    connectionId: string
    listingId: string
    shopifyProductId: string
    shopifyVariantId: string
    reswellSection: PeerListingSection
    syncStatus: ShopifyProductLinkSyncStatus
    shopifyUpdatedAt: string | null
    lastError?: string | null
  },
): Promise<ShopifyProductLinkRow> {
  const now = new Date().toISOString()
  const existing = await getShopifyLinkByVariantId(
    supabase,
    row.connectionId,
    row.shopifyVariantId,
  )

  if (existing) {
    const { data, error } = await supabase
      .from("shopify_product_links")
      .update({
        listing_id: row.listingId,
        reswell_section: row.reswellSection,
        sync_status: row.syncStatus,
        shopify_updated_at: row.shopifyUpdatedAt,
        last_synced_at: now,
        last_error: row.lastError ?? null,
        updated_at: now,
      })
      .eq("id", existing.id)
      .select(LINK_SELECT)
      .single()

    if (error || !data) throw new Error(error?.message ?? "Failed to update Shopify product link")
    return data as ShopifyProductLinkRow
  }

  const { data, error } = await supabase
    .from("shopify_product_links")
    .insert({
      user_id: row.userId,
      connection_id: row.connectionId,
      listing_id: row.listingId,
      shopify_product_id: row.shopifyProductId,
      shopify_variant_id: row.shopifyVariantId,
      reswell_section: row.reswellSection,
      sync_status: row.syncStatus,
      shopify_updated_at: row.shopifyUpdatedAt,
      last_synced_at: now,
      last_error: row.lastError ?? null,
      updated_at: now,
    })
    .select(LINK_SELECT)
    .single()

  if (error || !data) throw new Error(error?.message ?? "Failed to create Shopify product link")
  return data as ShopifyProductLinkRow
}

export async function updateShopifyLinkStatus(
  supabase: SupabaseClient,
  linkId: string,
  syncStatus: ShopifyProductLinkSyncStatus,
  lastError?: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("shopify_product_links")
    .update({
      sync_status: syncStatus,
      last_synced_at: new Date().toISOString(),
      last_error: lastError ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", linkId)

  if (error) throw new Error(error.message)
}
