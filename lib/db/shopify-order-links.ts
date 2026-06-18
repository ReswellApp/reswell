import type { SupabaseClient } from "@supabase/supabase-js"
import type { ShopifyOrderLinkRow, ShopifyOrderLinkStatus } from "@/lib/shopify/types"

const ORDER_LINK_SELECT =
  "id, user_id, connection_id, reswell_order_id, listing_id, shopify_variant_id, shopify_order_id, shopify_order_name, shopify_fulfillment_id, sync_status, attempts, last_error, created_at, updated_at" as const

/**
 * Idempotently get-or-create the pending link for a (reswell_order, listing) pair.
 * Returns the existing row when already present so order push is safe to retry.
 */
export async function getOrCreateShopifyOrderLink(
  supabase: SupabaseClient,
  input: {
    userId: string
    connectionId: string
    reswellOrderId: string
    listingId: string | null
    shopifyVariantId: string | null
  },
): Promise<ShopifyOrderLinkRow> {
  const existing = await getShopifyOrderLink(supabase, input.reswellOrderId, input.listingId)
  if (existing) return existing

  const { data, error } = await supabase
    .from("shopify_order_links")
    .insert({
      user_id: input.userId,
      connection_id: input.connectionId,
      reswell_order_id: input.reswellOrderId,
      listing_id: input.listingId,
      shopify_variant_id: input.shopifyVariantId,
      sync_status: "pending",
    })
    .select(ORDER_LINK_SELECT)
    .single()

  if (error) {
    // Lost a race; re-read the winner.
    if ((error as { code?: string }).code === "23505") {
      const row = await getShopifyOrderLink(supabase, input.reswellOrderId, input.listingId)
      if (row) return row
    }
    throw new Error(error.message)
  }
  return data as ShopifyOrderLinkRow
}

export async function getShopifyOrderLink(
  supabase: SupabaseClient,
  reswellOrderId: string,
  listingId: string | null,
): Promise<ShopifyOrderLinkRow | null> {
  let query = supabase
    .from("shopify_order_links")
    .select(ORDER_LINK_SELECT)
    .eq("reswell_order_id", reswellOrderId)

  query = listingId ? query.eq("listing_id", listingId) : query.is("listing_id", null)

  const { data, error } = await query.maybeSingle()
  if (error) throw new Error(error.message)
  return (data as ShopifyOrderLinkRow | null) ?? null
}

export async function updateShopifyOrderLink(
  supabase: SupabaseClient,
  id: string,
  patch: {
    sync_status?: ShopifyOrderLinkStatus
    shopify_order_id?: string | null
    shopify_order_name?: string | null
    shopify_fulfillment_id?: string | null
    last_error?: string | null
    incrementAttempts?: boolean
  },
): Promise<void> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.sync_status !== undefined) update.sync_status = patch.sync_status
  if (patch.shopify_order_id !== undefined) update.shopify_order_id = patch.shopify_order_id
  if (patch.shopify_order_name !== undefined) update.shopify_order_name = patch.shopify_order_name
  if (patch.shopify_fulfillment_id !== undefined)
    update.shopify_fulfillment_id = patch.shopify_fulfillment_id
  if (patch.last_error !== undefined) update.last_error = patch.last_error

  if (patch.incrementAttempts) {
    const { data: current } = await supabase
      .from("shopify_order_links")
      .select("attempts")
      .eq("id", id)
      .maybeSingle()
    update.attempts = ((current?.attempts as number | undefined) ?? 0) + 1
  }

  const { error } = await supabase.from("shopify_order_links").update(update).eq("id", id)
  if (error) throw new Error(error.message)
}

export async function listShopifyOrderLinksForUser(
  supabase: SupabaseClient,
  userId: string,
  limit = 50,
): Promise<ShopifyOrderLinkRow[]> {
  const { data, error } = await supabase
    .from("shopify_order_links")
    .select(ORDER_LINK_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data as ShopifyOrderLinkRow[]) ?? []
}
