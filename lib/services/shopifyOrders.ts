import type { SupabaseClient } from "@supabase/supabase-js"
import { getShopifyLinkByVariantId } from "@/lib/db/shopify-product-links"
import { getActiveShopifyConnectionForUser } from "@/lib/db/shopify-connections"
import { createShopifyDraftOrder } from "@/lib/shopify/admin-api"

/**
 * After a Reswell order completes, push a draft order to the seller's Shopify store
 * when the listing was imported from Shopify. Best-effort — never throws.
 */
export async function pushReswellOrderToShopifyBestEffort(opts: {
  serviceSupabase: SupabaseClient
  sellerId: string
  listingId: string
  listingTitle: string
  itemPriceUsd: number
  buyerEmail?: string | null
  reswellOrderId: string
}): Promise<void> {
  try {
    const { data: linkRow } = await opts.serviceSupabase
      .from("shopify_product_links")
      .select("connection_id, shopify_variant_id, shopify_product_id")
      .eq("listing_id", opts.listingId)
      .maybeSingle()

    if (!linkRow?.shopify_variant_id) return

    const connection = await getActiveShopifyConnectionForUser(opts.serviceSupabase, opts.sellerId)
    if (!connection || connection.id !== linkRow.connection_id) return

    await createShopifyDraftOrder({
      shopDomain: connection.shop_domain,
      accessToken: connection.access_token,
      lineItem: {
        variantId: linkRow.shopify_variant_id,
        quantity: 1,
        price: opts.itemPriceUsd.toFixed(2),
        title: opts.listingTitle,
      },
      customerEmail: opts.buyerEmail ?? undefined,
      note: `Reswell order ${opts.reswellOrderId}`,
    })
  } catch (error) {
    console.error("[shopify] push order failed", {
      listingId: opts.listingId,
      sellerId: opts.sellerId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

/** Lookup helper used by sync — exported for tests. */
export async function getShopifyLinkForListing(
  supabase: SupabaseClient,
  listingId: string,
) {
  const { data } = await supabase
    .from("shopify_product_links")
    .select("id, connection_id, shopify_variant_id, shopify_product_id, user_id")
    .eq("listing_id", listingId)
    .maybeSingle()
  return data
}

export { getShopifyLinkByVariantId }
