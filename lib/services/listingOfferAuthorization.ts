import type { SupabaseClient, User } from "@supabase/supabase-js"
import type Stripe from "stripe"
import { isAnonymousSupabaseUser } from "@/lib/auth/is-anonymous-user"
import { isBlockedOwnListingPurchase } from "@/lib/cart-eligibility"
import { readAdAttributionFromCookies } from "@/lib/ads/read-request-attribution"
import { stripeAdAttributionMetadata } from "@/lib/ads/attribution"
import {
  OFFER_AUTHORIZATION_MIN_CENTS,
  OFFER_BINDING_METADATA_KEY,
  OFFER_BINDING_METADATA_VALUE,
  canCaptureOfferAuthorization,
  canReleaseOfferAuthorization,
  isBindingOfferPaymentIntent,
  isOfferAuthorizationCaptured,
  offerAuthorizationAmountMatches,
  shouldCleanupOrphanOfferBinding,
} from "@/lib/listing-offer-authorization"
import { encodeListingQuantitiesMeta } from "@/lib/mixed-checkout"
import {
  offerShippingAmountFromListing,
  type ListingForOfferShipping,
} from "@/lib/offer-listing-shipping"
import { isPeerListingSection } from "@/lib/peer-listing-sections"
import type { ProfileAddressRow } from "@/lib/profile-address"
import { evaluateUserPurchase } from "@/lib/services/accountRestrictions"
import { ensureCheckoutBuyerShippingAddress } from "@/lib/services/checkoutBuyerAddress"
import { ensureCheckoutBuyerPhone } from "@/lib/services/checkoutBuyerPhone"
import {
  verifyCheckoutShippingQuoteToken,
  type CheckoutShippingPackageRate,
} from "@/lib/services/checkoutShippingQuoteToken"
import { assertBuyerMayPurchaseListingExclusiveWindow } from "@/lib/services/listingBuyerExclusiveWindow"
import { computePeerMultiCheckoutUsd } from "@/lib/services/peerMultiCheckoutTotals"
import {
  PEER_SURFBOARD_CHECKOUT_LISTING_SELECT,
  type PeerSurfboardCheckoutListingRow,
} from "@/lib/services/peerListingShippingQuote"
import { effectiveMinimumOfferPct } from "@/lib/utils/offers-minimum-pct"
import { getStripe, getStripeCheckoutKeyConfigError } from "@/lib/stripe-server"
import { fetchListingForOffer } from "@/lib/db/offers"
import type { CreateListingOfferPaymentIntentBody } from "@/lib/validations/listing-offer-authorization"

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

export type OfferAuthorizationTotals = {
  itemUsd: number
  shippingUsd: number
  totalUsd: number
  amountCents: number
  listing: PeerSurfboardCheckoutListingRow
  sellerId: string
  buyerAddress: ProfileAddressRow | null
  preverifiedShipping:
    | {
        shippingUsd: number
        usedReswellQuote: boolean
        rateId?: string | null
        serviceCode?: string | null
        packageRates?: CheckoutShippingPackageRate[] | null
      }
    | undefined
  anyUsedReswellQuote: boolean
  reswellQuote: {
    rateId?: string | null
    serviceCode?: string | null
  } | null
}

export type OfferAuthorizationComputeResult =
  | { ok: true; totals: OfferAuthorizationTotals }
  | { ok: false; status: number; error: string }

async function loadOfferAuthorizationListing(
  supabase: SupabaseClient,
  listingId: string,
): Promise<
  | { ok: true; listing: PeerSurfboardCheckoutListingRow }
  | { ok: false; status: number; error: string }
> {
  const { data, error } = await supabase
    .from("listings")
    .select(PEER_SURFBOARD_CHECKOUT_LISTING_SELECT)
    .eq("id", listingId)
    .in("status", ["active", "pending_sale"])
    .eq("hidden_from_site", false)
    .is("archived_at", null)
    .maybeSingle()

  if (error || !data) {
    return { ok: false, status: 404, error: "Listing not found or not available." }
  }
  return { ok: true, listing: data as unknown as PeerSurfboardCheckoutListingRow }
}

export async function computeOfferAuthorizationTotals(
  supabase: SupabaseClient,
  buyerId: string,
  listingId: string,
  input: {
    amount: number
    fulfillment: "pickup" | "shipping"
    addressId?: string | null
    quoteToken?: string | null
  },
): Promise<OfferAuthorizationComputeResult> {
  const listingCheck = await loadOfferAuthorizationListing(supabase, listingId)
  if (!listingCheck.ok) return listingCheck
  const listing = listingCheck.listing

  if (!isPeerListingSection(listing.section)) {
    return { ok: false, status: 400, error: "Offers are not available for this listing type." }
  }
  if (isBlockedOwnListingPurchase(listing, buyerId)) {
    return { ok: false, status: 400, error: "You can’t make an offer on your own listing." }
  }

  const exclusiveCheck = await assertBuyerMayPurchaseListingExclusiveWindow(
    supabase,
    listing.id,
    buyerId,
  )
  if (!exclusiveCheck.ok) {
    return { ok: false, status: 403, error: exclusiveCheck.message }
  }

  const offerListing = await fetchListingForOffer(supabase, listingId)
  if (!offerListing) {
    return { ok: false, status: 404, error: "Listing not found." }
  }
  if (offerListing.buyer_offers_enabled === false) {
    return { ok: false, status: 400, error: "The seller is not accepting offers on this item." }
  }

  const pickupOk = listing.local_pickup !== false
  const shipOk = !!listing.shipping_available
  if (input.fulfillment === "pickup" && !pickupOk) {
    return { ok: false, status: 400, error: "Local pickup isn’t available for this listing." }
  }
  if (input.fulfillment === "shipping" && !shipOk) {
    return { ok: false, status: 400, error: "Shipping isn’t available for this listing." }
  }

  const listPrice = roundMoney(parseFloat(String(listing.price)))
  if (!Number.isFinite(listPrice) || listPrice <= 0) {
    return { ok: false, status: 400, error: "This listing doesn’t have a valid price." }
  }

  const amount = roundMoney(input.amount)
  const minPct = effectiveMinimumOfferPct(offerListing)
  const minOffer = roundMoney(listPrice * (minPct / 100))
  if (amount < minOffer) {
    return {
      ok: false,
      status: 400,
      error: `Your offer must be at least $${minOffer.toFixed(2)} (${minPct}% of the list price).`,
    }
  }
  if (amount > listPrice) {
    return {
      ok: false,
      status: 400,
      error: `Your offer can’t exceed the list price ($${listPrice.toFixed(2)}).`,
    }
  }

  const addressId = input.addressId?.trim() || null
  let buyerAddress: ProfileAddressRow | null = null
  if (input.fulfillment === "shipping") {
    if (!addressId) {
      return { ok: false, status: 400, error: "Shipping address is required." }
    }
    const { data: addr, error: addrErr } = await supabase
      .from("addresses")
      .select("*")
      .eq("id", addressId)
      .eq("profile_id", buyerId)
      .maybeSingle()
    if (addrErr || !addr) {
      return { ok: false, status: 400, error: "Invalid shipping address." }
    }
    buyerAddress = addr as ProfileAddressRow
  }

  const phoneCheck = await ensureCheckoutBuyerPhone(supabase, buyerId, buyerAddress)
  if (!phoneCheck.ok) {
    return { ok: false, status: 400, error: phoneCheck.error }
  }
  buyerAddress = phoneCheck.address

  if (input.fulfillment === "shipping" && buyerAddress) {
    const preparedAddress = await ensureCheckoutBuyerShippingAddress({
      supabase,
      address: buyerAddress,
      listingSections: [listing.section],
    })
    if (!preparedAddress.ok) {
      return { ok: false, status: 422, error: preparedAddress.error }
    }
    buyerAddress = preparedAddress.address
  }

  let preverifiedShipping:
    | {
        shippingUsd: number
        usedReswellQuote: boolean
        rateId?: string | null
        serviceCode?: string | null
        packageRates?: CheckoutShippingPackageRate[] | null
      }
    | undefined

  const quoteTokenRaw = input.quoteToken?.trim() || null
  const snapshotShipping = offerShippingAmountFromListing(
    listing as ListingForOfferShipping,
    input.fulfillment,
  )

  if (input.fulfillment === "shipping" && snapshotShipping == null) {
    if (!quoteTokenRaw || !addressId) {
      return {
        ok: false,
        status: 400,
        error: "Add your address so we can calculate shipping before reserving payment.",
      }
    }
    const verified = verifyCheckoutShippingQuoteToken(quoteTokenRaw, {
      buyerId,
      listingIds: [listingId],
      addressId,
    })
    if (!verified.ok) {
      return { ok: false, status: 400, error: verified.error }
    }
    if (!verified.payload.usedReswellQuote) {
      return { ok: false, status: 400, error: "Invalid shipping quote token." }
    }
    preverifiedShipping = {
      shippingUsd: verified.payload.shippingCents / 100,
      usedReswellQuote: true,
      rateId: verified.payload.rateId?.trim() || null,
      serviceCode: verified.payload.serviceCode?.trim() || null,
      packageRates: verified.payload.packageRates ?? null,
    }
  }

  const pricedListing: PeerSurfboardCheckoutListingRow = {
    ...listing,
    price: amount,
  }

  const bundle = await computePeerMultiCheckoutUsd({
    supabase,
    listingsOrdered: [pricedListing],
    fulfillment: input.fulfillment,
    buyerAddress,
    diagnosticTagPrefix: "offer-authorization",
    preverifiedShipping,
    quantityByListingId: { [listingId]: 1 },
  })

  if (!bundle.ok) {
    return { ok: false, status: 422, error: bundle.error }
  }

  const amountCents = Math.round(bundle.totalUsd * 100)
  if (amountCents < OFFER_AUTHORIZATION_MIN_CENTS) {
    return { ok: false, status: 400, error: "Amount is below the minimum charge." }
  }

  return {
    ok: true,
    totals: {
      itemUsd: bundle.totalItemPriceUsd,
      shippingUsd: bundle.totalShippingUsd,
      totalUsd: bundle.totalUsd,
      amountCents,
      listing,
      sellerId: bundle.sellerId,
      buyerAddress,
      preverifiedShipping,
      anyUsedReswellQuote: bundle.anyUsedReswellQuote,
      reswellQuote: bundle.reswellQuote,
    },
  }
}

export type CreateOfferAuthorizationResult =
  | {
      ok: true
      clientSecret: string
      paymentIntentId: string
      itemUsd: number
      shippingUsd: number
      totalUsd: number
    }
  | { ok: false; status: number; error: string }

export async function createOfferAuthorizationPaymentIntent(
  supabase: SupabaseClient,
  user: User,
  listingId: string,
  body: CreateListingOfferPaymentIntentBody,
): Promise<CreateOfferAuthorizationResult> {
  if (isAnonymousSupabaseUser(user)) {
    return {
      ok: false,
      status: 403,
      error: "Create a Reswell account or sign in with email or Google to send an offer.",
    }
  }

  const keyConfigError = getStripeCheckoutKeyConfigError()
  if (keyConfigError) {
    return { ok: false, status: 503, error: keyConfigError }
  }

  const purchaseGuard = await evaluateUserPurchase(supabase, user.id)
  if (!purchaseGuard.ok) {
    return { ok: false, status: 403, error: purchaseGuard.userMessage }
  }

  const computed = await computeOfferAuthorizationTotals(supabase, user.id, listingId, {
    amount: body.amount,
    fulfillment: body.fulfillment,
    addressId: body.address_id,
    quoteToken: body.quote_token,
  })
  if (!computed.ok) return computed

  const { totals } = computed
  const addressId = body.address_id?.trim() || null
  const offerAmountCents = Math.round(roundMoney(body.amount) * 100)

  try {
    const stripe = getStripe()
    const adAttribution = await readAdAttributionFromCookies()
    const title = (totals.listing.title ?? "listing").trim() || "listing"

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totals.amountCents,
      currency: "usd",
      capture_method: "manual",
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      metadata: {
        [OFFER_BINDING_METADATA_KEY]: OFFER_BINDING_METADATA_VALUE,
        listing_ids: listingId,
        listing_id: listingId,
        listing_qtys: encodeListingQuantitiesMeta({ [listingId]: 1 }),
        buyer_id: user.id,
        seller_id: totals.sellerId,
        fulfillment: body.fulfillment,
        amount_cents: String(totals.amountCents),
        offer_amount_cents: String(offerAmountCents),
        bundle_line_count: "1",
        ...stripeAdAttributionMetadata(adAttribution),
        ...(addressId ? { address_id: addressId } : {}),
        ...(totals.anyUsedReswellQuote
          ? {
              reswell_shipping_cents: String(Math.round(totals.shippingUsd * 100)),
              ...(totals.reswellQuote?.rateId
                ? {
                    shipengine_rate_id: totals.reswellQuote.rateId,
                    ...(totals.reswellQuote.serviceCode
                      ? { shipengine_service_code: totals.reswellQuote.serviceCode }
                      : {}),
                  }
                : {}),
            }
          : {}),
      },
      description: `Reswell offer — ${title}`.slice(0, 1000),
    })

    const clientSecret = paymentIntent.client_secret
    if (!clientSecret) {
      await stripe.paymentIntents.cancel(paymentIntent.id).catch(() => undefined)
      return { ok: false, status: 502, error: "Could not start payment reservation." }
    }

    return {
      ok: true,
      clientSecret,
      paymentIntentId: paymentIntent.id,
      itemUsd: totals.itemUsd,
      shippingUsd: totals.shippingUsd,
      totalUsd: totals.totalUsd,
    }
  } catch (err: unknown) {
    const message =
      err instanceof Error && err.message.trim()
        ? err.message.trim()
        : "Could not reserve payment for this offer."
    console.error("[createOfferAuthorizationPaymentIntent]", message)
    return { ok: false, status: 502, error: "Could not reserve payment for this offer." }
  }
}

export type VerifyAuthorizedOfferResult =
  | {
      ok: true
      paymentIntent: Stripe.PaymentIntent
      shippingUsd: number
    }
  | { ok: false; status: number; error: string }

export async function verifyAuthorizedOfferPaymentIntent(
  supabase: SupabaseClient,
  buyerId: string,
  listingId: string,
  input: {
    paymentIntentId: string
    amount: number
    fulfillment: "pickup" | "shipping"
    addressId?: string | null
    quoteToken?: string | null
  },
): Promise<VerifyAuthorizedOfferResult> {
  const computed = await computeOfferAuthorizationTotals(supabase, buyerId, listingId, {
    amount: input.amount,
    fulfillment: input.fulfillment,
    addressId: input.addressId,
    quoteToken: input.quoteToken,
  })
  if (!computed.ok) return computed

  let paymentIntent: Stripe.PaymentIntent
  try {
    paymentIntent = await getStripe().paymentIntents.retrieve(input.paymentIntentId.trim())
  } catch (e) {
    console.error("[verifyAuthorizedOfferPaymentIntent] retrieve:", e)
    return { ok: false, status: 400, error: "Reserved payment was not found." }
  }

  const meta = paymentIntent.metadata ?? {}
  if (!isBindingOfferPaymentIntent(meta)) {
    return { ok: false, status: 400, error: "This payment is not an offer reservation." }
  }
  if (paymentIntent.status !== "requires_capture") {
    return {
      ok: false,
      status: 400,
      error: "Reserve payment in the offer window before sending.",
    }
  }
  if (meta.buyer_id !== buyerId || meta.listing_id !== listingId) {
    return { ok: false, status: 400, error: "Reserved payment does not match this offer." }
  }
  if (meta.fulfillment !== input.fulfillment) {
    return { ok: false, status: 400, error: "Reserved payment does not match delivery method." }
  }
  const expectedAddress = input.fulfillment === "shipping" ? input.addressId?.trim() || null : null
  const metaAddress = meta.address_id?.trim() || null
  if (expectedAddress !== metaAddress) {
    return { ok: false, status: 400, error: "Reserved payment does not match this address." }
  }
  if (meta.offer_id?.trim()) {
    return { ok: false, status: 409, error: "This reservation is already attached to an offer." }
  }
  if (!offerAuthorizationAmountMatches(paymentIntent.amount, computed.totals.amountCents)) {
    return {
      ok: false,
      status: 400,
      error: "Reserved amount no longer matches this offer. Go back and reserve again.",
    }
  }

  return {
    ok: true,
    paymentIntent,
    shippingUsd: computed.totals.shippingUsd,
  }
}

export async function attachOfferIdToPaymentIntent(
  paymentIntentId: string,
  offerId: string,
): Promise<void> {
  try {
    const stripe = getStripe()
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId)
    await stripe.paymentIntents.update(paymentIntentId, {
      metadata: {
        ...pi.metadata,
        offer_id: offerId,
      },
    })
  } catch (e) {
    console.error("[attachOfferIdToPaymentIntent]", e)
  }
}

export async function releaseOfferAuthorization(paymentIntentId: string | null | undefined): Promise<void> {
  const id = paymentIntentId?.trim()
  if (!id) return

  try {
    const stripe = getStripe()
    const pi = await stripe.paymentIntents.retrieve(id)
    if (!isBindingOfferPaymentIntent(pi.metadata)) return
    if (!canReleaseOfferAuthorization(pi.status)) return
    await stripe.paymentIntents.cancel(pi.id)
  } catch (e) {
    console.error("[releaseOfferAuthorization]", e)
  }
}

export async function releaseOfferAuthorizations(
  paymentIntentIds: Array<string | null | undefined>,
): Promise<void> {
  const unique = [...new Set(paymentIntentIds.map((id) => id?.trim()).filter((id): id is string => Boolean(id)))]
  for (const id of unique) {
    await releaseOfferAuthorization(id)
  }
}

export type CaptureOfferAuthorizationResult =
  | { ok: true; paymentIntent: Stripe.PaymentIntent }
  | { ok: false; error: string }

export async function captureOfferAuthorization(
  paymentIntentId: string,
): Promise<CaptureOfferAuthorizationResult> {
  const id = paymentIntentId.trim()
  if (!id) {
    return { ok: false, error: "This offer has no reserved payment." }
  }

  try {
    const stripe = getStripe()
    const pi = await stripe.paymentIntents.retrieve(id)
    if (!isBindingOfferPaymentIntent(pi.metadata)) {
      return { ok: false, error: "This offer has no reserved payment." }
    }
    if (isOfferAuthorizationCaptured(pi.status)) {
      return { ok: true, paymentIntent: pi }
    }
    if (!canCaptureOfferAuthorization(pi.status)) {
      return {
        ok: false,
        error: "The buyer’s reserved payment is no longer available. Ask them to send a new offer.",
      }
    }
    const captured = await stripe.paymentIntents.capture(pi.id)
    return { ok: true, paymentIntent: captured }
  } catch (e) {
    console.error("[captureOfferAuthorization]", e)
    return {
      ok: false,
      error: "Could not complete the reserved payment. Ask the buyer to send a new offer.",
    }
  }
}

export async function cancelOrphanOfferBindingPaymentIntents(
  referenceTime: Date = new Date(),
): Promise<number> {
  let canceled = 0
  try {
    const stripe = getStripe()
    const found = await stripe.paymentIntents.search({
      query: `status:'requires_capture' AND metadata['${OFFER_BINDING_METADATA_KEY}']:'${OFFER_BINDING_METADATA_VALUE}'`,
      limit: 50,
    })
    for (const pi of found.data) {
      if (
        !shouldCleanupOrphanOfferBinding({
          offerBinding: isBindingOfferPaymentIntent(pi.metadata),
          offerId: pi.metadata.offer_id,
          createdAtMs: pi.created * 1000,
          referenceTimeMs: referenceTime.getTime(),
        })
      ) {
        continue
      }
      if (!canReleaseOfferAuthorization(pi.status)) continue
      await stripe.paymentIntents.cancel(pi.id)
      canceled += 1
    }
  } catch (e) {
    console.error("[cancelOrphanOfferBindingPaymentIntents]", e)
  }
  return canceled
}
