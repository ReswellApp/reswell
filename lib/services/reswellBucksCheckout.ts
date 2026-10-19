import type { SupabaseClient, User } from "@supabase/supabase-js"
import { dedupeIdsPreserveOrder } from "@/lib/stripe-marketplace-metadata"
import { isAnonymousSupabaseUser } from "@/lib/auth/is-anonymous-user"
import { isBlockedOwnListingPurchase } from "@/lib/cart-eligibility"
import { attachListingInventorySources } from "@/lib/db/listingInventorySource"
import { settleAdminReswellBucksCheckout } from "@/lib/db/reswellBucksLedger"
import { getSellerBalance } from "@/lib/getSellerBalance"
import { getAuthEmailForUserId } from "@/lib/klaviyo/auth-user-email"
import { peerBrandNewUnitsRemaining } from "@/lib/listing-quantity"
import { isPeerListingSection } from "@/lib/peer-listing-sections"
import { formatPeerItemCountPhrase } from "@/lib/peer-listing-item-nouns"
import { profileAddressToOrderShippingJson, type ProfileAddressRow } from "@/lib/profile-address"
import { generatePickupCode } from "@/lib/order-status"
import { isReswellShopListing } from "@/lib/reswell-shop"
import { resolveMixedCheckoutSellerId } from "@/lib/mixed-checkout"
import { isShopifyManagedListing } from "@/lib/shopify/listing"
import { evaluateUserPurchase } from "@/lib/services/accountRestrictions"
import { validateAcceptedOfferForPaymentIntent } from "@/lib/services/acceptedOfferCheckout"
import { applyAcceptedOfferToPeerCheckoutListings, priceListingsFromAcceptedOffer } from "@/lib/services/applyAcceptedOfferToPeerCheckoutListings"
import { ensureCheckoutBuyerShippingAddress } from "@/lib/services/checkoutBuyerAddress"
import { ensureCheckoutBuyerPhone } from "@/lib/services/checkoutBuyerPhone"
import { validateCheckoutPromoForCheckout, type CheckoutPromoKind } from "@/lib/services/checkoutPromo"
import { verifyCheckoutShippingQuoteToken, type CheckoutShippingPackageRate } from "@/lib/services/checkoutShippingQuoteToken"
import { assertBuyerMayPurchaseListingExclusiveWindow } from "@/lib/services/listingBuyerExclusiveWindow"
import { computePeerMultiCheckoutUsd } from "@/lib/services/peerMultiCheckoutTotals"
import {
  PEER_SURFBOARD_CHECKOUT_LISTING_SELECT,
  type PeerSurfboardCheckoutListingRow,
} from "@/lib/services/peerListingShippingQuote"
import { runReswellBucksCheckoutSideEffects } from "@/lib/services/reswellBucksCheckoutSideEffects"
import {
  buildReswellBucksSettlement,
  ReswellBucksSettlementError,
} from "@/lib/services/reswellBucksSettlement"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { normalizeNewsletterPromoCodeInput } from "@/lib/utils/newsletter-promo-code"
import { promoCheckoutLinesFromPricedListings } from "@/lib/utils/promo-product-type"
import type { ReswellBucksCheckoutInput } from "@/lib/validations/reswell-bucks-checkout"
import {
  DEFAULT_SHIPPING_PACKAGING_MODE,
  resolveMultiItemPackagingMode,
  resolveShippingPackagingMode,
  type ShippingPackagingMode,
} from "@/lib/shipping/packaging-mode"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type ReswellBucksCheckoutFailure = { ok: false; status: number; error: string }
export type ReswellBucksCheckoutSuccess = {
  ok: true
  orderId: string
  orderNum: string | null
  replayed: boolean
  newBalanceUsd: number | null
}

export async function getAdminReswellBucksCheckoutOffer(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ spendableUsd: number } | null> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle()
  if (error || profile?.is_admin !== true) return null
  try {
    const balance = await getSellerBalance(supabase, userId)
    return { spendableUsd: balance.spendableBucks }
  } catch (err) {
    console.error("[reswell-bucks] balance", err)
    return { spendableUsd: 0 }
  }
}

function fail(status: number, error: string): ReswellBucksCheckoutFailure {
  return { ok: false, status, error }
}

function mapSettleError(message: string): ReswellBucksCheckoutFailure {
  if (message.includes("admin_only") || message.includes("forbidden")) {
    return fail(403, "Reswell Bucks checkout is limited to Reswell admins.")
  }
  if (message.includes("insufficient_balance")) {
    const match = /insufficient_balance:(-?\d+)/.exec(message)
    const cents = match ? Number(match[1]) : 0
    const available = (Number.isFinite(cents) ? Math.max(0, cents) : 0) / 100
    return fail(400, `Insufficient Reswell Bucks. Available: $${available.toFixed(2)}.`)
  }
  if (message.includes("listing_unavailable")) {
    return fail(409, "This listing is no longer available.")
  }
  if (message.includes("own_listing")) {
    return fail(400, "Cannot purchase your own listing.")
  }
  if (message.includes("wallet_balance_mismatch")) {
    return fail(500, "Wallet balance did not match the ledger line.")
  }
  if (message.includes("unbalanced")) {
    return fail(500, "This Reswell Bucks payment could not be balanced.")
  }
  if (
    message.includes("admin_settle_reswell_bucks_checkout") ||
    message.includes("schema cache")
  ) {
    return fail(503, "Reswell Bucks checkout is not available until the ledger migration is applied.")
  }
  console.error("[reswell-bucks] settle", message)
  return fail(500, "Could not complete Reswell Bucks checkout.")
}

export async function checkoutWithAdminReswellBucks(params: {
  supabase: SupabaseClient
  user: User
  input: ReswellBucksCheckoutInput
}): Promise<ReswellBucksCheckoutSuccess | ReswellBucksCheckoutFailure> {
  const { supabase, user, input } = params

  if (isAnonymousSupabaseUser(user)) {
    return fail(403, "Create a Reswell account or sign in to pay with Reswell Bucks.")
  }
  if (input.surfboard_shipped) {
    return fail(400, "Surfboard Shipped still uses card checkout.")
  }

  const purchaseGuard = await evaluateUserPurchase(supabase, user.id)
  if (!purchaseGuard.ok) {
    return fail(403, purchaseGuard.userMessage)
  }

  const offer = await getAdminReswellBucksCheckoutOffer(supabase, user.id)
  if (!offer) {
    return fail(403, "Reswell Bucks checkout is limited to Reswell admins.")
  }

  const fromArray = dedupeIdsPreserveOrder((input.listing_ids ?? []).filter((id) => UUID_RE.test(id)))
  const listingIdsOrdered =
    fromArray.length > 0 ? fromArray : input.listing_id && UUID_RE.test(input.listing_id) ? [input.listing_id] : []
  if (listingIdsOrdered.length === 0) {
    return fail(400, "Missing listing_id or listing_ids.")
  }

  const { data: listingsRows, error: listingsErr } = await supabase
    .from("listings")
    .select(`${PEER_SURFBOARD_CHECKOUT_LISTING_SELECT}, stock_quantity`)
    .in("id", listingIdsOrdered)
    .in("status", ["active", "pending_sale"])
    .eq("hidden_from_site", false)
    .is("archived_at", null)

  if (listingsErr || !listingsRows?.length) {
    return fail(404, "Listing not found or not available.")
  }

  const listingMap = new Map<string, PeerSurfboardCheckoutListingRow>(
    listingsRows.map((row) => {
      const listing = row as unknown as PeerSurfboardCheckoutListingRow
      return [listing.id, listing]
    }),
  )
  const listingsOrdered = listingIdsOrdered
    .map((id) => listingMap.get(id))
    .filter((row): row is PeerSurfboardCheckoutListingRow => row != null)
  if (listingsOrdered.length !== listingIdsOrdered.length) {
    return fail(404, "Listing not found or not available.")
  }

  const sourced = await attachListingInventorySources(supabase, listingsOrdered)
  if (!sourced.ok) return fail(500, sourced.error)
  for (let index = 0; index < listingsOrdered.length; index += 1) {
    const withSource = sourced.listings[index]
    if (withSource) listingsOrdered[index] = withSource
  }

  if (listingsOrdered.some((listing) => isBlockedOwnListingPurchase(listing, user.id))) {
    return fail(400, "Cannot purchase your own listing.")
  }
  for (const listing of listingsOrdered) {
    if (!isPeerListingSection(listing.section) || isReswellShopListing(listing.section) || isShopifyManagedListing(listing)) {
      return fail(
        400,
        "Reswell Bucks checkout is available for peer listings during the admin pilot. Shop inventory still uses card checkout.",
      )
    }
    const units = peerBrandNewUnitsRemaining(listing)
    if (units != null && units < 1) return fail(409, "This item is out of stock.")
    const exclusive = await assertBuyerMayPurchaseListingExclusiveWindow(supabase, listing.id, user.id)
    if (!exclusive.ok) return fail(403, exclusive.message)
  }

  const offerIdParam = input.offer_id?.trim() || null
  let validatedOfferId: string | null = null
  let listingsForTotals = listingsOrdered

  if (offerIdParam) {
    const offerCheck = await validateAcceptedOfferForPaymentIntent(
      supabase,
      user.id,
      offerIdParam,
      listingIdsOrdered,
    )
    if (!offerCheck.ok) return fail(400, offerCheck.error)
    validatedOfferId = offerIdParam
    listingsForTotals = priceListingsFromAcceptedOffer(listingsOrdered, offerCheck.offer, offerCheck.lineItems)
  } else if (listingIdsOrdered.length > 1) {
    const { data: cartRows, error: cartErr } = await supabase
      .from("cart_items")
      .select("listing_id, quantity")
      .eq("profile_id", user.id)
      .in("listing_id", listingIdsOrdered)
    if (cartErr) return fail(500, "Could not verify cart.")
    const cartQty = new Map<string, number>()
    for (const row of cartRows ?? []) {
      const id = String((row as { listing_id?: string }).listing_id ?? "")
      const qty = Math.max(1, Math.floor(Number((row as { quantity?: number }).quantity) || 1))
      if (id) cartQty.set(id, qty)
    }
    for (const id of listingIdsOrdered) {
      if (!cartQty.has(id)) {
        return fail(400, "Every item in a multi-item checkout must be in your cart.")
      }
      if ((cartQty.get(id) ?? 1) !== 1) {
        return fail(400, "Reswell Bucks checkout is one unit per listing during the admin pilot.")
      }
    }
    listingsForTotals = await applyAcceptedOfferToPeerCheckoutListings(supabase, user.id, listingsOrdered)
  } else {
    listingsForTotals = await applyAcceptedOfferToPeerCheckoutListings(supabase, user.id, listingsOrdered)
  }

  const mixedSeller = resolveMixedCheckoutSellerId(
    listingsOrdered.map((listing) => ({
      id: listing.id,
      user_id: listing.user_id,
      section: listing.section,
    })),
  )
  if (!mixedSeller.ok) return fail(400, mixedSeller.error)

  let impliedFulfillment: "pickup" | "shipping"
  if (listingsOrdered.length > 1) {
    if (input.fulfillment !== "pickup" && input.fulfillment !== "shipping") {
      return fail(400, "Choose pickup or shipping for this order.")
    }
    if (input.fulfillment === "pickup" && !listingsOrdered.every((listing) => listing.local_pickup !== false)) {
      return fail(400, "Every item in a multi-item pickup checkout must offer local pickup.")
    }
    if (input.fulfillment === "shipping" && !listingsOrdered.every((listing) => !!listing.shipping_available)) {
      return fail(400, "Every item in a multi-item shipped checkout must offer shipping.")
    }
    impliedFulfillment = input.fulfillment
  } else {
    const listing = listingsOrdered[0]!
    const canPickup = listing.local_pickup !== false
    const canShip = !!listing.shipping_available
    if (!canPickup && !canShip) return fail(400, "Listing has no fulfillment options.")
    if (canPickup && canShip) {
      if (input.fulfillment !== "pickup" && input.fulfillment !== "shipping") {
        return fail(400, "Choose pickup or shipping for this listing.")
      }
      impliedFulfillment = input.fulfillment
    } else {
      impliedFulfillment = canShip ? "shipping" : "pickup"
    }
  }

  const addressId = input.address_id?.trim() || null
  let buyerAddress: ProfileAddressRow | null = null
  if (impliedFulfillment === "shipping") {
    if (!addressId) return fail(400, "Shipping address is required.")
    const { data: addr, error: addrErr } = await supabase
      .from("addresses")
      .select("*")
      .eq("id", addressId)
      .eq("profile_id", user.id)
      .maybeSingle()
    if (addrErr || !addr) return fail(400, "Invalid shipping address.")
    buyerAddress = addr as ProfileAddressRow
  }

  const phoneCheck = await ensureCheckoutBuyerPhone(supabase, user.id, buyerAddress)
  if (!phoneCheck.ok) return fail(400, phoneCheck.error)
  buyerAddress = phoneCheck.address

  if (impliedFulfillment === "shipping" && buyerAddress) {
    const preparedAddress = await ensureCheckoutBuyerShippingAddress({
      supabase,
      address: buyerAddress,
      listingSections: listingsOrdered.map((row) => row.section),
    })
    if (!preparedAddress.ok) return fail(422, preparedAddress.error)
    buyerAddress = preparedAddress.address
  }

  const packagingMode: ShippingPackagingMode = resolveMultiItemPackagingMode({
    listings: listingsOrdered,
    requested: input.packaging_mode,
    fulfillment: impliedFulfillment,
  })

  let preverifiedShipping:
    | {
        shippingUsd: number
        usedReswellQuote: boolean
        rateId?: string | null
        serviceCode?: string | null
        packageRates?: CheckoutShippingPackageRate[] | null
      }
    | undefined
  const quoteToken = input.quote_token?.trim()
  if (impliedFulfillment === "shipping" && quoteToken && addressId) {
    const verified = verifyCheckoutShippingQuoteToken(quoteToken, {
      buyerId: user.id,
      listingIds: listingIdsOrdered,
      addressId,
    })
    if (!verified.ok) return fail(400, verified.error)
    if (!verified.payload.usedReswellQuote) return fail(400, "Invalid shipping quote token.")
    const tokenPackaging = resolveShippingPackagingMode(
      verified.payload.packagingMode,
      DEFAULT_SHIPPING_PACKAGING_MODE,
    )
    if (tokenPackaging !== packagingMode) {
      return fail(400, "Shipping quote does not match packaging choice. Refresh shipping and try again.")
    }
    preverifiedShipping = {
      shippingUsd: verified.payload.shippingCents / 100,
      usedReswellQuote: true,
      rateId: verified.payload.rateId?.trim() || null,
      serviceCode: verified.payload.serviceCode?.trim() || null,
      packageRates: verified.payload.packageRates ?? null,
    }
  }

  const bundle = await computePeerMultiCheckoutUsd({
    supabase,
    listingsOrdered: listingsForTotals,
    fulfillment: impliedFulfillment,
    buyerAddress,
    diagnosticTagPrefix: "reswell-bucks",
    packagingMode,
    preverifiedShipping,
    quantityByListingId: Object.fromEntries(listingIdsOrdered.map((id) => [id, 1])),
  })
  if (!bundle.ok) return fail(422, bundle.error)

  let promoDiscountUsd = 0
  let chargedUsd = bundle.totalUsd
  let promo: { kind: CheckoutPromoKind; id: string } | null = null
  const promoCode = input.promo_code?.trim()
    ? normalizeNewsletterPromoCodeInput(input.promo_code)
    : null
  if (promoCode) {
    const buyerEmail = (await getAuthEmailForUserId(user.id)) ?? user.email?.trim() ?? ""
    if (!buyerEmail) return fail(400, "Add an email to your account before using a promo code.")
    const promoCheck = await validateCheckoutPromoForCheckout({
      code: promoCode,
      buyerEmail,
      itemSubtotalUsd: bundle.totalItemPriceUsd,
      shippingUsd: bundle.totalShippingUsd,
      lines: promoCheckoutLinesFromPricedListings({
        listings: listingsForTotals,
        pricedLines: bundle.lines,
      }),
    })
    if (!promoCheck.ok) return fail(400, promoCheck.error)
    promoDiscountUsd = promoCheck.discountUsd
    chargedUsd = promoCheck.totalUsd
    promo = { kind: promoCheck.kind, id: promoCheck.promo.id }
  }

  let settlement
  try {
    settlement = buildReswellBucksSettlement({
      lines: bundle.lines,
      promoDiscountUsd,
      chargedUsd,
    })
  } catch (err) {
    if (err instanceof ReswellBucksSettlementError) {
      console.error("[reswell-bucks] unbalanced totals", err.message)
      return fail(409, "Checkout totals do not balance. Refresh and try again.")
    }
    throw err
  }

  if (settlement.amountCents > 0 && offer.spendableUsd + 0.001 < settlement.amountCents / 100) {
    return fail(400, `Insufficient Reswell Bucks. Available: $${offer.spendableUsd.toFixed(2)}.`)
  }

  const isPickup = impliedFulfillment === "pickup"
  const pickupCode = isPickup ? generatePickupCode() : null
  const shippingAddress = !isPickup && buyerAddress
    ? (JSON.parse(JSON.stringify(profileAddressToOrderShippingJson(buyerAddress, user.email ?? null))) as Record<
        string,
        unknown
      >)
    : null
  const titleSummary =
    listingsOrdered.length === 1
      ? String(listingsOrdered[0]?.title ?? "Item")
      : formatPeerItemCountPhrase(
          listingsOrdered.length,
          listingsOrdered.map((listing) => listing.section),
        )

  let serviceSupabase: SupabaseClient
  try {
    serviceSupabase = createServiceRoleClient()
  } catch {
    return fail(503, "Purchase could not be completed (server configuration).")
  }

  const settled = await settleAdminReswellBucksCheckout(serviceSupabase, {
    idempotency_key: input.idempotency_key,
    buyer_id: user.id,
    seller_id: mixedSeller.sellerId,
    amount_cents: settlement.amountCents,
    shipping_cents: settlement.shippingCents,
    platform_fee_cents: settlement.platformFeeCents,
    seller_earnings_cents: settlement.sellerEarningsCents,
    promo_discount_cents: settlement.promoDiscountCents,
    fulfillment_method: impliedFulfillment,
    delivery_status: isPickup ? "pickup_ready" : "pending",
    pickup_code: pickupCode,
    shipping_packaging_mode:
      !isPickup && listingsOrdered.length > 1 ? packagingMode : null,
    shipping_address: shippingAddress,
    promo_code_id: promo?.kind === "newsletter" ? promo.id : null,
    admin_promo_code_id: promo?.kind === "admin_issued" ? promo.id : null,
    title_summary: titleSummary,
    lines: settlement.lines.map((line) => ({
      listing_id: line.listingId,
      quantity: 1,
      item_price_cents: line.itemPriceCents,
      shipping_cents: line.shippingCents,
      platform_fee_cents: line.platformFeeCents,
      seller_earnings_cents: line.sellerEarningsCents,
    })),
  })

  if (!settled.ok) return mapSettleError(settled.message)

  const orderId = settled.row.order_id
  const orderNum = settled.row.order_num ?? null
  const replayed = settled.row.replayed === true
  const newBalanceUsd =
    typeof settled.row.buyer_balance_after_cents === "number"
      ? settled.row.buyer_balance_after_cents / 100
      : null

  if (!replayed) {
    try {
      await runReswellBucksCheckoutSideEffects(serviceSupabase, {
        orderId,
        orderNum,
        buyerId: user.id,
        buyerEmail: user.email ?? null,
        sellerId: mixedSeller.sellerId,
        listings: listingsForTotals.map((listing) => ({
          id: listing.id,
          title: listing.title,
          section: listing.section,
          slug: listing.slug,
          condition: listing.condition,
          quantity: listing.quantity,
        })),
        lines: settlement.lines,
        fulfillment: impliedFulfillment,
        pickupCode,
        packagingMode: !isPickup && listingsOrdered.length > 1 ? packagingMode : null,
        shippingAddress,
        packageRateByListingId: new Map(
          (bundle.packageRates ?? []).map((rate) => [rate.listingId, rate.rateId] as const),
        ),
        togetherRateId: bundle.reswellQuote?.rateId?.trim() || null,
        promo,
        chargedUsd: settlement.amountCents / 100,
        itemSubtotalUsd: (settlement.sellerEarningsCents + settlement.platformFeeCents) / 100,
        shippingUsd: settlement.shippingCents / 100,
        promoDiscountUsd: settlement.promoDiscountCents / 100,
        platformFeeUsd: settlement.platformFeeCents / 100,
        sellerEarningsUsd: settlement.sellerEarningsCents / 100,
        offerId: validatedOfferId,
      })
    } catch (err) {
      console.error("[reswell-bucks] side effects", { orderId, err })
    }
  }

  return { ok: true, orderId, orderNum, replayed, newBalanceUsd }
}
