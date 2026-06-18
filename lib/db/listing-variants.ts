import type { SupabaseClient } from "@supabase/supabase-js"
import type { ListingVariantRow } from "@/lib/shopify/types"

const VARIANT_SELECT =
  "id, listing_id, shopify_variant_id, title, option1, option2, option3, sku, price, compare_at_price, stock_quantity, reserved_quantity, in_stock, image_url, position" as const

export interface UpsertListingVariantInput {
  shopifyVariantId: string | null
  title: string
  option1?: string | null
  option2?: string | null
  option3?: string | null
  sku?: string | null
  price: number
  compareAtPrice?: number | null
  stockQuantity: number
  inStock: boolean
  imageUrl?: string | null
  position: number
}

export async function getListingVariants(
  supabase: SupabaseClient,
  listingId: string,
): Promise<ListingVariantRow[]> {
  const { data, error } = await supabase
    .from("listing_variants")
    .select(VARIANT_SELECT)
    .eq("listing_id", listingId)
    .order("position", { ascending: true })
  if (error) throw new Error(error.message)
  return (data as ListingVariantRow[]) ?? []
}

export async function getListingVariantById(
  supabase: SupabaseClient,
  variantId: string,
): Promise<ListingVariantRow | null> {
  const { data, error } = await supabase
    .from("listing_variants")
    .select(VARIANT_SELECT)
    .eq("id", variantId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as ListingVariantRow | null) ?? null
}

export async function getListingVariantByShopifyId(
  supabase: SupabaseClient,
  listingId: string,
  shopifyVariantId: string,
): Promise<ListingVariantRow | null> {
  const { data, error } = await supabase
    .from("listing_variants")
    .select(VARIANT_SELECT)
    .eq("listing_id", listingId)
    .eq("shopify_variant_id", shopifyVariantId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as ListingVariantRow | null) ?? null
}

/**
 * Replace the full variant set for a listing with the supplied variants. Removes variants no longer
 * present in Shopify, upserts the rest (preserving reserved_quantity on existing rows).
 */
export async function syncListingVariants(
  supabase: SupabaseClient,
  listingId: string,
  variants: UpsertListingVariantInput[],
): Promise<void> {
  const existing = await getListingVariants(supabase, listingId)
  const existingByShopifyId = new Map(
    existing.filter((v) => v.shopify_variant_id).map((v) => [v.shopify_variant_id as string, v]),
  )
  const incomingShopifyIds = new Set(
    variants.map((v) => v.shopifyVariantId).filter((id): id is string => Boolean(id)),
  )

  // Delete variants that no longer exist in Shopify.
  const toDelete = existing
    .filter((v) => v.shopify_variant_id && !incomingShopifyIds.has(v.shopify_variant_id))
    .map((v) => v.id)
  if (toDelete.length > 0) {
    await supabase.from("listing_variants").delete().in("id", toDelete)
  }

  const now = new Date().toISOString()
  for (const v of variants) {
    const prior = v.shopifyVariantId ? existingByShopifyId.get(v.shopifyVariantId) : undefined
    const payload = {
      listing_id: listingId,
      shopify_variant_id: v.shopifyVariantId,
      title: v.title,
      option1: v.option1 ?? null,
      option2: v.option2 ?? null,
      option3: v.option3 ?? null,
      sku: v.sku ?? null,
      price: v.price,
      compare_at_price: v.compareAtPrice ?? null,
      stock_quantity: v.stockQuantity,
      in_stock: v.inStock,
      image_url: v.imageUrl ?? null,
      position: v.position,
      updated_at: now,
    }

    if (prior) {
      await supabase.from("listing_variants").update(payload).eq("id", prior.id)
    } else {
      await supabase.from("listing_variants").insert(payload)
    }
  }
}

/** Recompute listing-level stock_quantity + status from variant rows. */
export async function refreshListingAggregateStock(
  supabase: SupabaseClient,
  listingId: string,
): Promise<void> {
  const variants = await getListingVariants(supabase, listingId)
  const totalStock = variants.reduce((sum, v) => sum + v.stock_quantity, 0)
  const anyInStock = variants.some((v) => v.in_stock && v.stock_quantity > v.reserved_quantity)
  await supabase
    .from("listings")
    .update({
      stock_quantity: totalStock,
      status: anyInStock ? "active" : "removed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", listingId)
}

/** Update a single variant's stock by Shopify variant id (used by inventory webhooks). */
export async function updateListingVariantStockByShopifyId(
  supabase: SupabaseClient,
  shopifyVariantId: string,
  stockQuantity: number,
): Promise<{ listingId: string } | null> {
  const inStock = stockQuantity > 0
  const { data, error } = await supabase
    .from("listing_variants")
    .update({
      stock_quantity: stockQuantity,
      in_stock: inStock,
      updated_at: new Date().toISOString(),
    })
    .eq("shopify_variant_id", shopifyVariantId)
    .select("listing_id")
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? { listingId: data.listing_id as string } : null
}
