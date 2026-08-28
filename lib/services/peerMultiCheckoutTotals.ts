import type { SupabaseClient } from "@supabase/supabase-js"
import type { ProfileAddressRow } from "@/lib/profile-address"
import { fetchSellerShipFromLabelName } from "@/lib/db/sellerShipFromLabel"
import { resolveCombinedPackedParcelFromListings } from "@/lib/reswell-packed-parcel-from-listing"
import {
  computePeerBundleShippingUsd,
  computePeerCheckoutTotalsUsd,
  type PeerReswellShippingQuote,
  type PeerSurfboardCheckoutListingRow,
} from "@/lib/services/peerListingShippingQuote"
import { fetchSellerFeeWaived } from "@/lib/db/profileSellerFee"
import { getSellerEarnings } from "@/lib/seller-fees"
import { resolveMixedCheckoutSellerId } from "@/lib/mixed-checkout"
import { getReswellShopLineEarnings, isReswellShopListing } from "@/lib/reswell-shop"
import {
  countSurfboardListings,
  peerCheckoutSurfboardCountError,
} from "@/lib/surfboard-multi-board-parcel"
import {
  DEFAULT_SHIPPING_PACKAGING_MODE,
  resolveShippingPackagingMode,
  type ShippingPackagingMode,
} from "@/lib/shipping/packaging-mode"
import type { CheckoutShippingPackageRate } from "@/lib/services/checkoutShippingQuoteToken"

export type PeerCheckoutLineComputation = {
  listingId: string
  quantity: number
  /** Unit item price (before quantity). */
  itemPrice: number
  shippingUsd: number
  totalUsd: number
  usedReswellQuote: boolean
  platformFee: number
  sellerEarnings: number
  /** Separate packaging: ShipEngine rate for this line (when Reswell-quoted). */
  packageRateId?: string | null
  packageServiceCode?: string | null
}

/**
 * Computes totals for peer listings (same seller) and/or Reswell shop lines.
 *
 * Multi-line shipping defaults to **one box** (together). When
 * `packagingMode` is `separate`, each line is quoted as its own parcel and
 * carries its own shipping charge.
 */
export async function computePeerMultiCheckoutUsd(params: {
  supabase: SupabaseClient
  listingsOrdered: PeerSurfboardCheckoutListingRow[]
  fulfillment: "pickup" | "shipping"
  buyerAddress: ProfileAddressRow | null
  diagnosticTagPrefix: string
  packagingMode?: ShippingPackagingMode | null
  /**
   * Reuse the signed checkout quote. Rate lookups are free; this avoids a second
   * ShipEngine /rates call. Does not purchase a label.
   */
  preverifiedShipping?: {
    shippingUsd: number
    usedReswellQuote: boolean
    rateId?: string | null
    serviceCode?: string | null
    packageRates?: CheckoutShippingPackageRate[] | null
  }
  /** Units per listing id (shop inventory). Peer lines default to 1. */
  quantityByListingId?: Record<string, number>
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
      reswellQuote: PeerReswellShippingQuote | null
      packagingMode: ShippingPackagingMode
      packageRates: CheckoutShippingPackageRate[]
    }
  | { ok: false; error: string }
> {
  const {
    listingsOrdered,
    fulfillment,
    buyerAddress,
    supabase,
    diagnosticTagPrefix,
    preverifiedShipping,
    quantityByListingId,
  } = params

  if (listingsOrdered.length === 0) {
    return { ok: false, error: "No listings to checkout" }
  }

  const packagingMode =
    fulfillment === "shipping" && listingsOrdered.length > 1
      ? resolveShippingPackagingMode(params.packagingMode, DEFAULT_SHIPPING_PACKAGING_MODE)
      : DEFAULT_SHIPPING_PACKAGING_MODE

  const surfboardCapError = peerCheckoutSurfboardCountError(countSurfboardListings(listingsOrdered))
  if (surfboardCapError) {
    return { ok: false, error: surfboardCapError }
  }

  const sellerResolved = resolveMixedCheckoutSellerId(
    listingsOrdered.map((l) => ({
      id: l.id,
      user_id: l.user_id,
      section: l.section,
    })),
  )
  if (!sellerResolved.ok) {
    return { ok: false, error: sellerResolved.error }
  }
  const sellerId = sellerResolved.sellerId

  const qtyFor = (listingId: string, section: string | null) => {
    if (isReswellShopListing(section)) {
      return Math.max(1, Math.floor(quantityByListingId?.[listingId] ?? 1))
    }
    return 1
  }

  const isMultiLine = listingsOrdered.length > 1
  if (isMultiLine) {
    if (fulfillment === "pickup" && !listingsOrdered.every((l) => l.local_pickup !== false)) {
      return {
        ok: false,
        error: "Every item in a multi-item pickup checkout must offer local pickup.",
      }
    }
    if (fulfillment === "shipping" && !listingsOrdered.every((l) => !!l.shipping_available)) {
      return {
        ok: false,
        error: "Every item in a multi-item shipped checkout must offer shipping.",
      }
    }
  }

  const sellerShipFromName =
    fulfillment === "shipping" && !preverifiedShipping
      ? await fetchSellerShipFromLabelName(supabase, sellerId)
      : "Seller"

  const feeWaived = await fetchSellerFeeWaived(sellerId)

  const lines: PeerCheckoutLineComputation[] = []
  let anyUsedReswellQuote = false
  let reswellQuote: PeerReswellShippingQuote | null = null
  const packageRates: CheckoutShippingPackageRate[] = []

  const shipSeparately = isMultiLine && fulfillment === "shipping" && packagingMode === "separate"

  if (shipSeparately && preverifiedShipping?.usedReswellQuote) {
    if (!preverifiedShipping.packageRates?.length) {
      return {
        ok: false,
        error: "Separate-package shipping quote is incomplete. Refresh shipping and try again.",
      }
    }
  }

  /** Together multi-line: per-line totals shipping-free, then one bundle charge on line 0. */
  const perLineFulfillment: "pickup" | "shipping" =
    isMultiLine && fulfillment === "shipping" && !shipSeparately ? "pickup" : fulfillment

  const singleLineShippingOverride =
    !isMultiLine && fulfillment === "shipping" && preverifiedShipping ? preverifiedShipping : undefined

  const preverifiedByListing = new Map(
    (preverifiedShipping?.packageRates ?? []).map((r) => [r.listingId, r]),
  )

  for (let i = 0; i < listingsOrdered.length; i++) {
    const listing = listingsOrdered[i]!
    const quantity = qtyFor(listing.id, listing.section)
    const lineOverride = shipSeparately
      ? (() => {
          const pkg = preverifiedByListing.get(listing.id)
          if (!pkg) return undefined
          return {
            shippingUsd: pkg.shippingCents / 100,
            usedReswellQuote: true as const,
            rateId: pkg.rateId,
            serviceCode: pkg.serviceCode,
          }
        })()
      : singleLineShippingOverride

    const totals = await computePeerCheckoutTotalsUsd({
      listing,
      fulfillment: perLineFulfillment,
      buyerAddress,
      diagnosticTag: `${diagnosticTagPrefix}:${listing.id}:${i}`,
      sellerShipFromName,
      shippingOverride: lineOverride,
    })
    if (!totals.ok) {
      return { ok: false, error: totals.error }
    }
    if (
      shipSeparately &&
      preverifiedShipping?.usedReswellQuote &&
      totals.usedReswellQuote &&
      !preverifiedByListing.has(listing.id)
    ) {
      return {
        ok: false,
        error: "Separate-package shipping quote is incomplete. Refresh shipping and try again.",
      }
    }
    if (totals.usedReswellQuote) anyUsedReswellQuote = true
    if (totals.reswellQuote) reswellQuote = totals.reswellQuote

    const unitPrice = totals.itemPrice
    const lineItemTotal = Math.round(unitPrice * quantity * 100) / 100

    let platformFee: number
    let sellerEarnings: number
    if (isReswellShopListing(listing.section)) {
      const shop = getReswellShopLineEarnings(unitPrice, quantity)
      platformFee = shop.platformFee
      sellerEarnings = shop.sellerEarnings
    } else {
      ;({ marketplaceFee: platformFee, sellerEarnings } = getSellerEarnings(lineItemTotal, {
        feeWaived,
      }))
    }

    const shippingUsd = shipSeparately
      ? totals.shippingUsd
      : isMultiLine
        ? 0
        : totals.shippingUsd

    const packageRateId =
      shipSeparately && totals.usedReswellQuote
        ? totals.reswellQuote?.rateId?.trim() || lineOverride?.rateId?.trim() || null
        : null
    const packageServiceCode =
      shipSeparately && totals.usedReswellQuote
        ? totals.reswellQuote?.serviceCode?.trim() || lineOverride?.serviceCode?.trim() || null
        : null

    if (packageRateId) {
      packageRates.push({
        listingId: listing.id,
        rateId: packageRateId,
        shippingCents: Math.round(shippingUsd * 100),
        serviceCode: packageServiceCode,
      })
    }

    lines.push({
      listingId: listing.id,
      quantity,
      itemPrice: unitPrice,
      shippingUsd,
      totalUsd: Math.round((lineItemTotal + shippingUsd) * 100) / 100,
      usedReswellQuote: totals.usedReswellQuote,
      platformFee,
      sellerEarnings,
      packageRateId,
      packageServiceCode,
    })
  }

  if (isMultiLine && fulfillment === "shipping" && !shipSeparately) {
    const bundleShipping = preverifiedShipping
      ? (() => {
          const parcelCheck = resolveCombinedPackedParcelFromListings(listingsOrdered)
          if (!parcelCheck.ok) {
            return parcelCheck
          }
          const rateId = preverifiedShipping.rateId?.trim() || ""
          return {
            ok: true as const,
            shippingUsd: preverifiedShipping.shippingUsd,
            usedReswellQuote: preverifiedShipping.usedReswellQuote,
            quote:
              preverifiedShipping.usedReswellQuote && rateId
                ? {
                    shippingUsd: preverifiedShipping.shippingUsd,
                    rateId,
                    serviceCode: preverifiedShipping.serviceCode?.trim() || "",
                    serviceName: "",
                    availableRates: [],
                  }
                : undefined,
          }
        })()
      : await computePeerBundleShippingUsd({
          listings: listingsOrdered,
          buyerAddress,
          diagnosticTag: `${diagnosticTagPrefix}:bundle`,
          sellerShipFromName,
        })
    if (!bundleShipping.ok) {
      return { ok: false, error: bundleShipping.error }
    }
    if (bundleShipping.usedReswellQuote) anyUsedReswellQuote = true
    if (bundleShipping.quote) reswellQuote = bundleShipping.quote

    /** Carry the one-box shipping charge on the first line so line sums stay exact. */
    const firstLine = lines[0]!
    const firstItemTotal = Math.round(firstLine.itemPrice * firstLine.quantity * 100) / 100
    firstLine.shippingUsd = bundleShipping.shippingUsd
    firstLine.totalUsd = Math.round((firstItemTotal + bundleShipping.shippingUsd) * 100) / 100
    firstLine.usedReswellQuote = bundleShipping.usedReswellQuote
  }

  if (shipSeparately && preverifiedShipping?.usedReswellQuote) {
    const expected = Math.round(preverifiedShipping.shippingUsd * 100)
    const got = Math.round(lines.reduce((s, l) => s + l.shippingUsd, 0) * 100)
    if (Math.abs(expected - got) > 1) {
      return {
        ok: false,
        error: "Shipping quote does not match separate-package totals. Refresh shipping and try again.",
      }
    }
  }

  const totalItemPriceUsd =
    Math.round(lines.reduce((s, l) => s + l.itemPrice * l.quantity, 0) * 100) / 100
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
    reswellQuote,
    packagingMode,
    packageRates,
  }
}
