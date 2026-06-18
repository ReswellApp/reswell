import type { SupabaseClient } from "@supabase/supabase-js"
import { getListingVariantById } from "@/lib/db/listing-variants"
import type { ListingVariantRow } from "@/lib/shopify/types"

export type VariantReservationResult =
  | { ok: true; available: number }
  | { ok: false; error: "variant_not_found" | "insufficient_stock"; available?: number }

interface RpcReservePayload {
  ok?: boolean
  error?: string
  available?: number
  reserved?: number
  stock_quantity?: number
}

/**
 * Reserve stock for a sync-managed variant at checkout start. Row-locked in Postgres to prevent
 * the same SKU overselling across Shopify and Reswell. Call {@link releaseVariantStock} if the
 * checkout is abandoned, or {@link commitVariantStock} once payment succeeds.
 */
export async function reserveVariantStock(
  supabase: SupabaseClient,
  variantId: string,
  quantity = 1,
): Promise<VariantReservationResult> {
  const { data, error } = await supabase.rpc("reserve_listing_variant_stock", {
    p_variant_id: variantId,
    p_quantity: quantity,
  })
  if (error) return { ok: false, error: "variant_not_found" }

  const payload = (data ?? {}) as RpcReservePayload
  if (payload.ok) return { ok: true, available: payload.available ?? 0 }
  if (payload.error === "insufficient_stock") {
    return { ok: false, error: "insufficient_stock", available: payload.available ?? 0 }
  }
  return { ok: false, error: "variant_not_found" }
}

export async function releaseVariantStock(
  supabase: SupabaseClient,
  variantId: string,
  quantity = 1,
): Promise<void> {
  await supabase.rpc("release_listing_variant_stock", {
    p_variant_id: variantId,
    p_quantity: quantity,
  })
}

export async function commitVariantStock(
  supabase: SupabaseClient,
  variantId: string,
  quantity = 1,
): Promise<{ ok: boolean; stockQuantity?: number }> {
  const { data, error } = await supabase.rpc("commit_listing_variant_stock", {
    p_variant_id: variantId,
    p_quantity: quantity,
  })
  if (error) return { ok: false }
  const payload = (data ?? {}) as RpcReservePayload
  return { ok: Boolean(payload.ok), stockQuantity: payload.stock_quantity }
}

export type CheckoutVariantResolution =
  | { ok: true; variant: ListingVariantRow }
  | { ok: false; error: string }

/**
 * Resolve and validate the variant a buyer selected for a listing at checkout.
 * Ensures the variant belongs to the listing and currently has available (unreserved) stock.
 */
export async function resolveCheckoutVariant(
  supabase: SupabaseClient,
  listingId: string,
  variantId: string,
  quantity = 1,
): Promise<CheckoutVariantResolution> {
  const variant = await getListingVariantById(supabase, variantId)
  if (!variant || variant.listing_id !== listingId) {
    return { ok: false, error: "Selected option is not available for this item" }
  }
  const available = variant.stock_quantity - variant.reserved_quantity
  if (available < quantity) {
    return { ok: false, error: "That option just sold out — pick another" }
  }
  return { ok: true, variant }
}
