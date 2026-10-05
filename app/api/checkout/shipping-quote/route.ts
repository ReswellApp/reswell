import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isBlockedOwnListingPurchase } from "@/lib/cart-eligibility"
import { PEER_LISTING_SECTIONS_FILTER } from "@/lib/peer-listing-sections"
import { resolveMixedCheckoutSellerId } from "@/lib/mixed-checkout"
import type { ProfileAddressRow } from "@/lib/profile-address"
import { fetchSellerShipFromLabelName } from "@/lib/db/sellerShipFromLabel"
import { fetchSellerShipFromAddressOrNull } from "@/lib/services/sellerShipFromAddress"
import { applyAcceptedOfferToPeerCheckoutListings } from "@/lib/services/applyAcceptedOfferToPeerCheckoutListings"
import {
  computePeerBundleShippingUsd,
  computePeerCheckoutTotalsUsd,
  effectiveBoardShippingMode,
  PEER_SURFBOARD_CHECKOUT_LISTING_SELECT,
  type PeerSurfboardCheckoutListingRow,
} from "@/lib/services/peerListingShippingQuote"
import {
  signCheckoutShippingQuoteToken,
  type CheckoutShippingPackageRate,
} from "@/lib/services/checkoutShippingQuoteToken"
import {
  countSurfboardListings,
  peerCheckoutSurfboardCountError,
} from "@/lib/surfboard-multi-board-parcel"
import {
  checkoutOffersShippingPackagingChoice,
  DEFAULT_SHIPPING_PACKAGING_MODE,
  resolveShippingPackagingMode,
  type ShippingPackagingMode,
} from "@/lib/shipping/packaging-mode"
import { computePeerMultiCheckoutUsd } from "@/lib/services/peerMultiCheckoutTotals"
import { ensureCheckoutBuyerShippingAddress } from "@/lib/services/checkoutBuyerAddress"
import {
  airCargoPieceCount,
  composeAirCargoCheckoutQuote,
  isAirCargoServiceCode,
  type AirCargoPackageRate,
} from "@/lib/shipping/air-cargo"

function buildQuoteResponse(input: {
  itemPrice: number
  shippingUsd: number
  totalUsd: number
  usedReswellQuote: boolean
  buyerId: string
  listingIds: string[]
  addressId: string
  packagingMode?: ShippingPackagingMode
  packageRates?: CheckoutShippingPackageRate[]
  reswellQuote?: {
    rateId: string
    serviceCode: string
    serviceName: string
    availableRates: Array<{
      rateId: string
      serviceCode: string
      serviceName: string
      displayName: string
      totalAmount: number
      deliveryDays: number | null
      estimatedDeliveryDate: string | null
    }>
  }
}) {
  const selectedRate =
    input.reswellQuote?.rateId
      ? {
          rateId: input.reswellQuote.rateId,
          serviceCode: input.reswellQuote.serviceCode,
          serviceName: input.reswellQuote.serviceName,
        }
      : null

  return {
    itemPrice: input.itemPrice,
    shippingUsd: input.shippingUsd,
    totalUsd: input.totalUsd,
    usedReswellQuote: input.usedReswellQuote,
    packagingMode: input.packagingMode ?? DEFAULT_SHIPPING_PACKAGING_MODE,
    selectedRate,
    availableShippingRates: input.reswellQuote?.availableRates ?? null,
    quoteToken:
      input.usedReswellQuote
        ? signCheckoutShippingQuoteToken({
            buyerId: input.buyerId,
            listingIds: input.listingIds,
            addressId: input.addressId,
            itemSubtotalUsd: input.itemPrice,
            shippingUsd: input.shippingUsd,
            totalUsd: input.totalUsd,
            usedReswellQuote: true,
            rateId: input.reswellQuote?.rateId ?? null,
            serviceCode: input.reswellQuote?.serviceCode ?? null,
            packagingMode: input.packagingMode,
            packageRates: input.packageRates,
          })
        : null,
  }
}

function listingsOfferAirCargo(listings: PeerSurfboardCheckoutListingRow[]): boolean {
  return (
    listings.length > 0 &&
    listings.every(
      (listing) => listing.section === "surfboards" && effectiveBoardShippingMode(listing) === "reswell",
    )
  )
}

/** Price and address problems are not solved by switching the buyer to air cargo. */
function isHardShippingQuoteError(error: string): boolean {
  return (
    error === "Invalid listing price" ||
    error === "Shipping address is required" ||
    error === "No listings to quote shipping for." ||
    error === "No listings to rate for shipping."
  )
}

function jsonQuotedShipping(input: {
  itemPrice: number
  buyerId: string
  listingIds: string[]
  addressId: string
  packagingMode?: ShippingPackagingMode
  offersAirCargo: boolean
  requestedServiceCode: string | null
  carrier:
    | {
        ok: true
        shippingUsd: number
        usedReswellQuote: boolean
        selectedRate: { rateId: string; serviceCode: string; serviceName: string } | null
        availableRates: Array<{
          rateId: string
          serviceCode: string
          serviceName: string
          displayName: string
          totalAmount: number
          deliveryDays: number | null
          estimatedDeliveryDate: string | null
        }> | null
        packageRates?: AirCargoPackageRate[] | null
      }
    | { ok: false; error: string }
}) {
  const packagingMode = input.packagingMode ?? DEFAULT_SHIPPING_PACKAGING_MODE
  const composed = composeAirCargoCheckoutQuote({
    offersAirCargo: input.offersAirCargo,
    // Lane quote (origin + destination airport + packed piece) is not wired yet.
    // Leaving this null keeps air cargo off checkout instead of charging a flat fee.
    airCargoQuoteUsd: null,
    requestedServiceCode: input.requestedServiceCode,
    pieceCount: airCargoPieceCount({
      packagingMode,
      listingCount: input.listingIds.length,
    }),
    listingIds: input.listingIds,
    packagingMode,
    carrier: input.carrier,
  })
  if (!composed.ok) {
    return NextResponse.json(
      { error: composed.error },
      { status: 422, headers: JSON_NO_STORE_HEADERS },
    )
  }

  const totalUsd = Math.round((input.itemPrice + composed.shippingUsd) * 100) / 100
  return NextResponse.json(
    {
      data: {
        ...buildQuoteResponse({
          itemPrice: input.itemPrice,
          shippingUsd: composed.shippingUsd,
          totalUsd,
          usedReswellQuote: composed.usedReswellQuote,
          buyerId: input.buyerId,
          listingIds: input.listingIds,
          addressId: input.addressId,
          packagingMode,
          packageRates: composed.packageRates,
          reswellQuote: composed.usedReswellQuote
            ? {
                rateId: composed.selectedRate?.rateId ?? "",
                serviceCode: composed.selectedRate?.serviceCode ?? "",
                serviceName: composed.selectedRate?.serviceName ?? "",
                availableRates: composed.availableRates ?? [],
              }
            : undefined,
        }),
        groundShippingUsd: composed.groundShippingUsd,
        groundUnavailableReason: composed.groundUnavailableReason,
      },
    },
    { headers: JSON_NO_STORE_HEADERS },
  )
}

export const dynamic = "force-dynamic"

const JSON_NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
} as const

export async function POST(request: Request) {
  const supabase = await createClient()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: JSON_NO_STORE_HEADERS },
    )
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: "Sign in to get a shipping quote." },
      { status: 401, headers: JSON_NO_STORE_HEADERS },
    )
  }

  const bodyObj = body && typeof body === "object" ? (body as Record<string, unknown>) : {}
  const fromArray = Array.isArray(bodyObj.listing_ids)
    ? bodyObj.listing_ids
        .map((x) => (typeof x === "string" ? x.trim() : ""))
        .filter((x) => x.length > 0)
    : []
  const singleId = String(bodyObj.listing_id ?? "").trim()
  const listingIds = [...new Set(fromArray.length > 0 ? fromArray : singleId ? [singleId] : [])]
  const addressId = String(bodyObj.address_id ?? "").trim()
  const selectedRateId = String(bodyObj.selected_rate_id ?? "").trim() || null
  const selectedServiceCode = String(bodyObj.selected_service_code ?? "").trim() || null
  const offerId = String(bodyObj.offer_id ?? "").trim() || null
  const packagingModeRequested = resolveShippingPackagingMode(
    bodyObj.packaging_mode,
    DEFAULT_SHIPPING_PACKAGING_MODE,
  )

  if (listingIds.length === 0 || !addressId) {
    return NextResponse.json(
      { error: "listing_id (or listing_ids) and address_id are required" },
      { status: 400, headers: JSON_NO_STORE_HEADERS },
    )
  }

  const { data: listingRowsRaw, error: listingError } = await supabase
    .from("listings")
    .select(PEER_SURFBOARD_CHECKOUT_LISTING_SELECT)
    .in("id", listingIds)
    .in("section", [...PEER_LISTING_SECTIONS_FILTER, "new"])
    .eq("hidden_from_site", false)
    .is("archived_at", null)
    .in("status", ["active", "pending_sale"])

  if (listingError || !listingRowsRaw || listingRowsRaw.length !== listingIds.length) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404, headers: JSON_NO_STORE_HEADERS })
  }

  /** Runtime select fragment loses Supabase's row inference; cast through `unknown` once. */
  let listingRows = listingRowsRaw as unknown as PeerSurfboardCheckoutListingRow[]

  // Preserve checkout listing order from the request (offer bundles are ordered).
  const listingById = new Map(listingRows.map((row) => [row.id, row]))
  listingRows = listingIds
    .map((id) => listingById.get(id))
    .filter((row): row is PeerSurfboardCheckoutListingRow => row != null)

  listingRows = await applyAcceptedOfferToPeerCheckoutListings(supabase, user.id, listingRows, {
    offerId,
  })

  if (listingRows.some((l) => isBlockedOwnListingPurchase(l, user.id))) {
    return NextResponse.json(
      { error: "Cannot quote your own listing" },
      { status: 400, headers: JSON_NO_STORE_HEADERS },
    )
  }

  const mixedSeller = resolveMixedCheckoutSellerId(
    listingRows.map((l) => ({
      id: l.id,
      user_id: l.user_id,
      section: l.section,
    })),
  )
  if (!mixedSeller.ok) {
    return NextResponse.json(
      { error: mixedSeller.error },
      { status: 400, headers: JSON_NO_STORE_HEADERS },
    )
  }
  const sellerId = mixedSeller.sellerId

  const surfboardCapError = peerCheckoutSurfboardCountError(countSurfboardListings(listingRows))
  if (surfboardCapError) {
    return NextResponse.json(
      { error: surfboardCapError },
      { status: 422, headers: JSON_NO_STORE_HEADERS },
    )
  }

  if (!listingRows.every((l) => !!l.shipping_available)) {
    return NextResponse.json(
      { error: "Every item in this order must offer shipping." },
      { status: 422, headers: JSON_NO_STORE_HEADERS },
    )
  }

  const { data: addr, error: addrErr } = await supabase
    .from("addresses")
    .select("*")
    .eq("id", addressId)
    .eq("profile_id", user.id)
    .maybeSingle()

  if (addrErr || !addr) {
    return NextResponse.json({ error: "Address not found" }, { status: 400, headers: JSON_NO_STORE_HEADERS })
  }

  const sellerShipFromName = await fetchSellerShipFromLabelName(supabase, sellerId)
  const sellerShipFromAddress = await fetchSellerShipFromAddressOrNull(supabase, sellerId)
  const preparedAddress = await ensureCheckoutBuyerShippingAddress({
    supabase,
    address: addr as ProfileAddressRow,
    listingSections: listingRows.map((row) => row.section),
  })
  if (!preparedAddress.ok) {
    return NextResponse.json(
      { error: preparedAddress.error },
      { status: 422, headers: JSON_NO_STORE_HEADERS },
    )
  }
  const buyerAddress = preparedAddress.address

  const qtyById = new Map<string, number>()
  for (const id of listingIds) qtyById.set(id, 1)
  const { data: cartQtyRows } = await supabase
    .from("cart_items")
    .select("listing_id, quantity")
    .eq("profile_id", user.id)
    .in("listing_id", listingIds)
  for (const row of cartQtyRows ?? []) {
    const id = String((row as { listing_id?: string }).listing_id ?? "").trim()
    const qty = Math.max(1, Math.floor(Number((row as { quantity?: number }).quantity) || 1))
    if (id) qtyById.set(id, qty)
  }

  const offersAirCargo = listingsOfferAirCargo(listingRows)
  const carrierServiceCode = isAirCargoServiceCode(selectedServiceCode) ? null : selectedServiceCode
  const carrierRateId = isAirCargoServiceCode(selectedServiceCode) ? null : selectedRateId

  if (listingRows.length === 1) {
    const listingRow = listingRows[0]!
    const qty = qtyById.get(listingRow.id) ?? 1
    const totals = await computePeerCheckoutTotalsUsd({
      listing: listingRow,
      fulfillment: "shipping",
      buyerAddress,
      diagnosticTag: `checkout-quote:${listingRow.id}`,
      sellerShipFromName,
      sellerShipFromAddress,
      selectedRateId: carrierRateId,
      selectedServiceCode: carrierServiceCode,
    })

    const unitPrice = parseFloat(String(listingRow.price))
    const fallbackItemPrice =
      Number.isFinite(unitPrice) && unitPrice >= 0 ? Math.round(unitPrice * qty * 100) / 100 : 0

    return jsonQuotedShipping({
      itemPrice: totals.ok ? Math.round(totals.itemPrice * qty * 100) / 100 : fallbackItemPrice,
      buyerId: user.id,
      listingIds,
      addressId,
      offersAirCargo: offersAirCargo && (totals.ok || !isHardShippingQuoteError(totals.error)),
      requestedServiceCode: selectedServiceCode,
      carrier: totals.ok
        ? {
            ok: true,
            shippingUsd: totals.shippingUsd,
            usedReswellQuote: totals.usedReswellQuote,
            selectedRate: totals.reswellQuote
              ? {
                  rateId: totals.reswellQuote.rateId,
                  serviceCode: totals.reswellQuote.serviceCode,
                  serviceName: totals.reswellQuote.serviceName,
                }
              : null,
            availableRates: totals.reswellQuote?.availableRates ?? null,
          }
        : { ok: false, error: totals.error },
    })
  }

  const packagingMode: ShippingPackagingMode =
    checkoutOffersShippingPackagingChoice(listingRows) && packagingModeRequested === "separate"
      ? "separate"
      : "together"

  if (packagingMode === "separate") {
    const quantityByListingId = Object.fromEntries(qtyById.entries())
    const multi = await computePeerMultiCheckoutUsd({
      supabase,
      listingsOrdered: listingRows,
      fulfillment: "shipping",
      buyerAddress,
      diagnosticTagPrefix: `checkout-quote-separate:${listingIds.join(",")}`,
      packagingMode: "separate",
      quantityByListingId,
    })
    const separateItemPrice = listingRows.reduce((sum, listing) => {
      const price = parseFloat(String(listing.price))
      const qty = qtyById.get(listing.id) ?? 1
      return sum + (Number.isFinite(price) && price > 0 ? price * qty : 0)
    }, 0)

    return jsonQuotedShipping({
      itemPrice: multi.ok ? multi.totalItemPriceUsd : Math.round(separateItemPrice * 100) / 100,
      buyerId: user.id,
      listingIds,
      addressId,
      packagingMode: "separate",
      offersAirCargo: offersAirCargo && (multi.ok || !isHardShippingQuoteError(multi.error)),
      requestedServiceCode: selectedServiceCode,
      carrier: multi.ok
        ? {
            ok: true,
            shippingUsd: multi.totalShippingUsd,
            usedReswellQuote: multi.anyUsedReswellQuote,
            selectedRate: null,
            availableRates: [],
            packageRates: multi.packageRates,
          }
        : { ok: false, error: multi.error },
    })
  }

  /** Multi-item together: one combined-parcel quote for the seller group. */
  const itemPriceSum = listingRows.reduce((sum, l) => {
    const p = parseFloat(String(l.price))
    const qty = qtyById.get(l.id) ?? 1
    return sum + (Number.isFinite(p) && p > 0 ? p * qty : 0)
  }, 0)
  const itemPrice = Math.round(itemPriceSum * 100) / 100

  const bundleShipping = await computePeerBundleShippingUsd({
    listings: listingRows,
    buyerAddress,
    diagnosticTag: `checkout-quote-bundle:${listingIds.join(",")}`,
    sellerShipFromName,
    sellerShipFromAddress,
    selectedRateId: carrierRateId,
    selectedServiceCode: carrierServiceCode,
  })

  return jsonQuotedShipping({
    itemPrice,
    buyerId: user.id,
    listingIds,
    addressId,
    packagingMode: "together",
    offersAirCargo: offersAirCargo && (bundleShipping.ok || !isHardShippingQuoteError(bundleShipping.error)),
    requestedServiceCode: selectedServiceCode,
    carrier: bundleShipping.ok
      ? {
          ok: true,
          shippingUsd: bundleShipping.shippingUsd,
          usedReswellQuote: bundleShipping.usedReswellQuote,
          selectedRate: bundleShipping.quote
            ? {
                rateId: bundleShipping.quote.rateId,
                serviceCode: bundleShipping.quote.serviceCode,
                serviceName: bundleShipping.quote.serviceName,
              }
            : null,
          availableRates: bundleShipping.quote?.availableRates ?? null,
        }
      : { ok: false, error: bundleShipping.error },
  })
}
