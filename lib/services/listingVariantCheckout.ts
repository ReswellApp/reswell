import type { SupabaseClient } from "@supabase/supabase-js"
import { getListingVariants, refreshListingAggregateStock } from "@/lib/db/listing-variants"
import {
  commitVariantStock,
  releaseVariantStock,
  reserveVariantStock,
  resolveCheckoutVariant,
} from "@/lib/services/shopifyInventory"

export type ListingVariantSelection = {
  listingId: string
  variantId: string
}

/** Parse `listingId:variantId` pairs from Stripe PaymentIntent metadata. */
export function parseVariantByListingMetadata(raw: string | undefined | null): Map<string, string> {
  const map = new Map<string, string>()
  if (!raw?.trim()) return map
  for (const segment of raw.split(",")) {
    const [listingId, variantId] = segment.split(":")
    if (listingId?.trim() && variantId?.trim()) {
      map.set(listingId.trim(), variantId.trim())
    }
  }
  return map
}

export function serializeVariantByListingMetadata(selections: ListingVariantSelection[]): string {
  return selections.map((s) => `${s.listingId}:${s.variantId}`).join(",")
}

/**
 * Resolve required variant selections for checkout.
 * - Listings without `has_variants`: no selection required.
 * - Single in-stock variant: auto-selected.
 * - Multi-variant: buyer must pass `variant_id` per listing (or single `variant_id` for one listing).
 */
export async function resolveCheckoutVariantSelections(opts: {
  supabase: SupabaseClient
  listings: Array<{ id: string; has_variants?: boolean | null }>
  requestedByListing: Map<string, string>
}): Promise<{ ok: true; selections: ListingVariantSelection[] } | { ok: false; error: string }> {
  const selections: ListingVariantSelection[] = []

  for (const listing of opts.listings) {
    if (!listing.has_variants) continue

    const requested = opts.requestedByListing.get(listing.id)
    if (requested) {
      const resolved = await resolveCheckoutVariant(opts.supabase, listing.id, requested, 1)
      if (!resolved.ok) return { ok: false, error: resolved.error }
      selections.push({ listingId: listing.id, variantId: resolved.variant.id })
      continue
    }

    const variants = await getListingVariants(opts.supabase, listing.id)
    const inStock = variants.filter((v) => v.in_stock && v.stock_quantity - v.reserved_quantity > 0)
    if (inStock.length === 1) {
      selections.push({ listingId: listing.id, variantId: inStock[0]!.id })
      continue
    }
    return {
      ok: false,
      error: "Select an option before checkout",
    }
  }

  return { ok: true, selections }
}

export async function reserveCheckoutVariantSelections(
  supabase: SupabaseClient,
  selections: ListingVariantSelection[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  for (const sel of selections) {
    const result = await reserveVariantStock(supabase, sel.variantId, 1)
    if (!result.ok) {
      return {
        ok: false,
        error:
          result.error === "insufficient_stock"
            ? "That option just sold out — pick another"
            : "Selected option is not available",
      }
    }
  }
  return { ok: true }
}

export async function releaseCheckoutVariantSelections(
  supabase: SupabaseClient,
  selections: ListingVariantSelection[],
): Promise<void> {
  for (const sel of selections) {
    await releaseVariantStock(supabase, sel.variantId, 1)
  }
}

/** Commit reserved variant stock after payment and refresh listing aggregate. */
export async function commitCheckoutVariantSelections(
  supabase: SupabaseClient,
  selections: ListingVariantSelection[],
): Promise<{ ok: true } | { ok: false; error: string; listingId?: string }> {
  for (const sel of selections) {
    const result = await commitVariantStock(supabase, sel.variantId, 1)
    if (!result.ok) {
      return { ok: false, error: "Could not commit variant inventory", listingId: sel.listingId }
    }
    await refreshListingAggregateStock(supabase, sel.listingId)
  }
  return { ok: true }
}
