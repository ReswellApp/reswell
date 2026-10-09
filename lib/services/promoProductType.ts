import type { SupabaseClient } from "@supabase/supabase-js"
import { attachListingInventorySources } from "@/lib/db/listingInventorySource"
import {
  dbListPromoPricedListings,
  dbShopifyReswellSectionsByListingIds,
} from "@/lib/db/promoProductTypes"
import { fetchAdminIssuedPromoById } from "@/lib/db/adminIssuedPromoCodes"
import { isPeerListingSection, type PeerListingSection } from "@/lib/peer-listing-sections"
import { applyAcceptedOfferToPeerCheckoutListings } from "@/lib/services/applyAcceptedOfferToPeerCheckoutListings"
import type { PeerSurfboardCheckoutListingRow } from "@/lib/services/peerListingShippingQuote"
import {
  eligiblePromoItemSubtotalUsd,
  normalizeAdminPromoEligibleSections,
  promoPreviewQuantity,
  promoProductTypeForListing,
  promoProductTypeRestrictionError,
  type PromoCheckoutLine,
} from "@/lib/utils/promo-product-type"

export async function withResolvedPromoProductTypes(
  supabase: SupabaseClient,
  lines: readonly PromoCheckoutLine[],
): Promise<{ lines: PromoCheckoutLine[]; error: string | null }> {
  const untypedIds = lines
    .filter((line) => !isPeerListingSection(line.section))
    .map((line) => line.listingId)

  let shopifySections = new Map<string, PeerListingSection>()
  if (untypedIds.length > 0) {
    const mapped = await dbShopifyReswellSectionsByListingIds(supabase, untypedIds)
    if (mapped.error) {
      console.error("[promo-product-type] shopify section lookup:", mapped.error)
      return { lines: [], error: "Could not verify promo code." }
    }
    shopifySections = mapped.sections
  }

  return {
    lines: lines.map((line) => ({
      ...line,
      productType: promoProductTypeForListing({
        section: line.section,
        shopifyReswellSection: shopifySections.get(line.listingId) ?? null,
      }),
    })),
    error: null,
  }
}

export async function loadPromoCheckoutLinesForPreview(
  supabase: SupabaseClient,
  params: {
    buyerId: string
    offerId?: string | null
    requestedLines: readonly { id: string; quantity: number }[]
  },
): Promise<{ lines: PromoCheckoutLine[]; error: string | null }> {
  const requestedById = new Map<string, number>()
  for (const line of params.requestedLines) {
    const id = line.id.trim()
    if (!id || requestedById.has(id)) continue
    requestedById.set(id, line.quantity)
  }
  if (requestedById.size === 0) return { lines: [], error: null }

  const listed = await dbListPromoPricedListings(supabase, [...requestedById.keys()])
  if (listed.error) {
    console.error("[promo-product-type] listing lookup:", listed.error)
    return { lines: [], error: "Could not verify promo code." }
  }
  if (listed.rows.length === 0) return { lines: [], error: null }

  const sourced = await attachListingInventorySources(supabase, listed.rows)
  if (!sourced.ok) return { lines: [], error: sourced.error }

  const priced = await applyAcceptedOfferToPeerCheckoutListings(
    supabase,
    params.buyerId,
    sourced.listings as unknown as PeerSurfboardCheckoutListingRow[],
    { offerId: params.offerId },
  )

  const lines: PromoCheckoutLine[] = priced.map((listing) => {
    const stock = sourced.listings.find((row) => row.id === listing.id)?.stock_quantity ?? null
    const inventorySource =
      sourced.listings.find((row) => row.id === listing.id)?.inventory_source ?? null
    return {
      listingId: listing.id,
      section: listing.section,
      unitPriceUsd: Number(listing.price),
      quantity: promoPreviewQuantity({
        section: listing.section,
        inventorySource,
        requested: requestedById.get(listing.id) ?? 1,
        stockQuantity: stock,
      }),
      inventorySource,
    }
  })

  return { lines, error: null }
}

/**
 * Item subtotal a stored admin code is allowed to discount.
 * Unrestricted codes use the full cart subtotal.
 */
export async function eligibleItemSubtotalForAdminPromo(params: {
  supabase: SupabaseClient
  promoId: string
  lines: readonly PromoCheckoutLine[]
  itemSubtotalUsd: number
}): Promise<{ ok: true; eligibleItemSubtotalUsd: number } | { ok: false; error: string }> {
  const { row, error } = await fetchAdminIssuedPromoById(params.supabase, params.promoId)
  if (error) {
    console.error("[promo-product-type] promo lookup:", error)
    return { ok: false, error: "Could not verify promo code." }
  }
  if (!row) return { ok: false, error: "That promo code is not valid." }

  const sections = normalizeAdminPromoEligibleSections(row.eligible_sections)
  if (!sections) return { ok: true, eligibleItemSubtotalUsd: params.itemSubtotalUsd }

  const resolved = await withResolvedPromoProductTypes(params.supabase, params.lines)
  if (resolved.error) return { ok: false, error: resolved.error }

  const eligibleItemSubtotalUsd = eligiblePromoItemSubtotalUsd(resolved.lines, sections)
  if (eligibleItemSubtotalUsd <= 0) {
    return { ok: false, error: promoProductTypeRestrictionError(sections) }
  }
  return { ok: true, eligibleItemSubtotalUsd }
}
