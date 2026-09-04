import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isBlockedOwnListingPurchase } from "@/lib/cart-eligibility"
import { PEER_LISTING_SECTIONS_FILTER } from "@/lib/peer-listing-sections"
import { resolveMixedCheckoutSellerId } from "@/lib/mixed-checkout"
import type { ProfileAddressRow } from "@/lib/profile-address"
import { fetchSellerShipFromLabelName } from "@/lib/db/sellerShipFromLabel"
import { applyAcceptedOfferToPeerCheckoutListings } from "@/lib/services/applyAcceptedOfferToPeerCheckoutListings"
import {
  computePeerBundleShippingUsd,
  computePeerCheckoutTotalsUsd,
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
  findPeerCheckoutRateOption,
  findPeerCheckoutRateOptionByServiceCode,
  peerCheckoutSharedSection,
} from "@/lib/shipping/peer-checkout-usps-services"
import {
  checkoutOffersShippingPackagingChoice,
  DEFAULT_SHIPPING_PACKAGING_MODE,
  resolveShippingPackagingMode,
  type ShippingPackagingMode,
} from "@/lib/shipping/packaging-mode"
import { computePeerMultiCheckoutUsd } from "@/lib/services/peerMultiCheckoutTotals"

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
  const selectedRate = input.reswellQuote
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
  const buyerAddress = addr as ProfileAddressRow

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

  if (listingRows.length === 1) {
    const listingRow = listingRows[0]!
    const totals = await computePeerCheckoutTotalsUsd({
      listing: listingRow,
      fulfillment: "shipping",
      buyerAddress,
      diagnosticTag: `checkout-quote:${listingRow.id}`,
      sellerShipFromName,
      selectedRateId,
      selectedServiceCode,
    })

    if (!totals.ok) {
      return NextResponse.json({ error: totals.error }, { status: 422, headers: JSON_NO_STORE_HEADERS })
    }

    if (totals.usedReswellQuote && totals.reswellQuote && (selectedRateId || selectedServiceCode)) {
      const selected =
        (selectedRateId
          ? findPeerCheckoutRateOption(totals.reswellQuote.availableRates, selectedRateId)
          : null) ??
        findPeerCheckoutRateOptionByServiceCode(
          totals.reswellQuote.availableRates,
          selectedServiceCode,
          listingRow.section,
        )
      if (!selected) {
        return NextResponse.json(
          { error: "Selected shipping option is no longer available." },
          { status: 422, headers: JSON_NO_STORE_HEADERS },
        )
      }
    }

    const qty = qtyById.get(listingRow.id) ?? 1
    const itemPrice = Math.round(totals.itemPrice * qty * 100) / 100
    const totalUsd = Math.round((itemPrice + totals.shippingUsd) * 100) / 100

    return NextResponse.json(
      {
        data: buildQuoteResponse({
          itemPrice,
          shippingUsd: totals.shippingUsd,
          totalUsd,
          usedReswellQuote: totals.usedReswellQuote,
          buyerId: user.id,
          listingIds,
          addressId,
          reswellQuote: totals.reswellQuote,
        }),
      },
      { headers: JSON_NO_STORE_HEADERS },
    )
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
    if (!multi.ok) {
      return NextResponse.json({ error: multi.error }, { status: 422, headers: JSON_NO_STORE_HEADERS })
    }

    return NextResponse.json(
      {
        data: buildQuoteResponse({
          itemPrice: multi.totalItemPriceUsd,
          shippingUsd: multi.totalShippingUsd,
          totalUsd: multi.totalUsd,
          usedReswellQuote: multi.anyUsedReswellQuote,
          buyerId: user.id,
          listingIds,
          addressId,
          packagingMode: "separate",
          packageRates: multi.packageRates,
          reswellQuote: multi.reswellQuote ?? undefined,
        }),
      },
      { headers: JSON_NO_STORE_HEADERS },
    )
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
    selectedRateId,
    selectedServiceCode,
  })

  if (!bundleShipping.ok) {
    return NextResponse.json({ error: bundleShipping.error }, { status: 422, headers: JSON_NO_STORE_HEADERS })
  }

  return NextResponse.json(
    {
      data: buildQuoteResponse({
        itemPrice,
        shippingUsd: bundleShipping.shippingUsd,
        totalUsd: Math.round((itemPrice + bundleShipping.shippingUsd) * 100) / 100,
        usedReswellQuote: bundleShipping.usedReswellQuote,
        buyerId: user.id,
        listingIds,
        addressId,
        packagingMode: "together",
        reswellQuote: bundleShipping.quote,
      }),
    },
    { headers: JSON_NO_STORE_HEADERS },
  )
}
