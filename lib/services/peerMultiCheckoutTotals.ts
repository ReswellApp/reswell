import type { SupabaseClient } from "@supabase/supabase-js"
import type { ProfileAddressRow } from "@/lib/profile-address"
import { fetchSellerShipFromLabelName } from "@/lib/db/sellerShipFromLabel"
import {
  computePeerBundleShippingUsd,
  computePeerCheckoutTotalsUsd,
  type PeerSurfboardCheckoutListingRow,
} from "@/lib/services/peerListingShippingQuote"
import { fetchSellerFeeWaived } from "@/lib/db/profileSellerFee"
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
 *
 * Multi-line shipping ships as **one box**: a single combined-parcel quote
 * (biggest item's dims + summed weights — see {@link computePeerBundleShippingUsd}).
 * The bundle shipping charge is carried on the first line; subsequent lines have $0 shipping.
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

  const isMultiLine = listingsOrdered.length > 1
  if (isMultiLine) {
    if (fulfillment === "pickup" && !listingsOrdered.every((l) => l.local_pickup !== false)) {
      return {
        ok: false,
        error: "Every board in a multi-item pickup checkout must offer local pickup.",
      }
    }
    if (fulfillment === "shipping" && !listingsOrdered.every((l) => !!l.shipping_available)) {
      return {
        ok: false,
        error: "Every board in a multi-item shipped checkout must offer shipping.",
      }
    }
  }

  const sellerShipFromName =
    fulfillment === "shipping"
      ? await fetchSellerShipFromLabelName(supabase, sellerId)
      : "Seller"

  const feeWaived = await fetchSellerFeeWaived(sellerId)

  const lines: PeerCheckoutLineComputation[] = []
  let anyUsedReswellQuote = false

  /** Multi-line shipping is quoted once for the whole box — per-line totals are computed shipping-free. */
  const perLineFulfillment: "pickup" | "shipping" =
    isMultiLine && fulfillment === "shipping" ? "pickup" : fulfillment

  for (let i = 0; i < listingsOrdered.length; i++) {
    const listing = listingsOrdered[i]!
    const totals = await computePeerCheckoutTotalsUsd({
      listing,
      fulfillment: perLineFulfillment,
      buyerAddress,
      diagnosticTag: `${diagnosticTagPrefix}:${listing.id}:${i}`,
      sellerShipFromName,
    })
    if (!totals.ok) {
      return { ok: false, error: totals.error }
    }
    if (totals.usedReswellQuote) anyUsedReswellQuote = true

    const { marketplaceFee: platformFee, sellerEarnings } = getSellerEarnings(totals.itemPrice, {
      feeWaived,
    })

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

  if (isMultiLine && fulfillment === "shipping") {
    const bundleShipping = await computePeerBundleShippingUsd({
      listings: listingsOrdered,
      buyerAddress,
      diagnosticTag: `${diagnosticTagPrefix}:bundle`,
      sellerShipFromName,
    })
    if (!bundleShipping.ok) {
      return { ok: false, error: bundleShipping.error }
    }
    if (bundleShipping.usedReswellQuote) anyUsedReswellQuote = true

    /** Carry the one-box shipping charge on the first line so line sums stay exact. */
    const firstLine = lines[0]!
    firstLine.shippingUsd = bundleShipping.shippingUsd
    firstLine.totalUsd = Math.round((firstLine.itemPrice + bundleShipping.shippingUsd) * 100) / 100
    firstLine.usedReswellQuote = bundleShipping.usedReswellQuote
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
