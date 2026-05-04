import type { SupabaseClient } from "@supabase/supabase-js"
import type { ProfileAddressRow } from "@/lib/profile-address"
import { fetchSellerShipFromLabelName } from "@/lib/db/sellerShipFromLabel"
import {
  computePeerCheckoutTotalsUsd,
  type PeerSurfboardCheckoutListingRow,
} from "@/lib/services/peerListingShippingQuote"
import { getSellerEarnings } from "@/lib/seller-fees"

export type PeerCheckoutLineComputation = {
  listingId: string
  itemPrice: number
  shippingUsd: number
  totalUsd: number
  usedReswellQuote: boolean
  platformFee: number
  sellerEarnings: number
}

/**
 * Computes totals for one or more peer surfboard listings (same seller).
 * Bundles with more than one line support **local pickup only** — shipping stays single-board per PaymentIntent.
 */
export async function computePeerMultiCheckoutUsd(params: {
  supabase: SupabaseClient
  listingsOrdered: PeerSurfboardCheckoutListingRow[]
  fulfillment: "pickup" | "shipping"
  buyerAddress: ProfileAddressRow | null
  diagnosticTagPrefix: string
}): Promise<
  | {
      ok: true
      sellerId: string
      lines: PeerCheckoutLineComputation[]
      totalUsd: number
      totalShippingUsd: number
      totalItemPriceUsd: number
      totalPlatformFee: number
      totalSellerEarnings: number
      anyUsedReswellQuote: boolean
    }
  | { ok: false; error: string }
> {
  const { listingsOrdered, fulfillment, buyerAddress, supabase, diagnosticTagPrefix } = params

  if (listingsOrdered.length === 0) {
    return { ok: false, error: "No listings to checkout" }
  }

  const sellerId = listingsOrdered[0]!.user_id
  if (!listingsOrdered.every((l) => l.user_id === sellerId)) {
    return { ok: false, error: "All items must be from the same seller" }
  }

  if (listingsOrdered.length > 1) {
    if (fulfillment !== "pickup") {
      return {
        ok: false,
        error:
          "Shipping checkout supports one board at a time. Complete pickup for multiple boards from this seller in one order, or check out shipped boards separately.",
      }
    }
    if (!listingsOrdered.every((l) => l.local_pickup !== false)) {
      return {
        ok: false,
        error: "Every board in a multi-item checkout must offer local pickup.",
      }
    }
  }

  const sellerShipFromName =
    fulfillment === "shipping"
      ? await fetchSellerShipFromLabelName(supabase, sellerId)
      : "Seller"

  const lines: PeerCheckoutLineComputation[] = []
  let anyUsedReswellQuote = false

  for (let i = 0; i < listingsOrdered.length; i++) {
    const listing = listingsOrdered[i]!
    const totals = await computePeerCheckoutTotalsUsd({
      listing,
      fulfillment,
      buyerAddress,
      diagnosticTag: `${diagnosticTagPrefix}:${listing.id}:${i}`,
      sellerShipFromName,
    })
    if (!totals.ok) {
      return { ok: false, error: totals.error }
    }
    if (totals.usedReswellQuote) anyUsedReswellQuote = true

    const { marketplaceFee: platformFee, sellerEarnings } = getSellerEarnings(totals.itemPrice)

    lines.push({
      listingId: listing.id,
      itemPrice: totals.itemPrice,
      shippingUsd: totals.shippingUsd,
      totalUsd: totals.totalUsd,
      usedReswellQuote: totals.usedReswellQuote,
      platformFee,
      sellerEarnings,
    })
  }

  const totalItemPriceUsd =
    Math.round(lines.reduce((s, l) => s + l.itemPrice, 0) * 100) / 100
  const totalShippingUsd =
    Math.round(lines.reduce((s, l) => s + l.shippingUsd, 0) * 100) / 100
  const totalUsd = Math.round(lines.reduce((s, l) => s + l.totalUsd, 0) * 100) / 100
  const totalPlatformFee =
    Math.round(lines.reduce((s, l) => s + l.platformFee, 0) * 100) / 100
  const totalSellerEarnings =
    Math.round(lines.reduce((s, l) => s + l.sellerEarnings, 0) * 100) / 100

  return {
    ok: true,
    sellerId,
    lines,
    totalUsd,
    totalShippingUsd,
    totalItemPriceUsd,
    totalPlatformFee,
    totalSellerEarnings,
    anyUsedReswellQuote,
  }
}
