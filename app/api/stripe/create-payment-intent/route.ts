import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { getStripe, getStripeCheckoutKeyConfigError } from "@/lib/stripe-server"
import type { ProfileAddressRow } from "@/lib/profile-address"
import {
  PEER_SURFBOARD_CHECKOUT_LISTING_SELECT,
  type PeerSurfboardCheckoutListingRow,
} from "@/lib/services/peerListingShippingQuote"
import { computePeerMultiCheckoutUsd } from "@/lib/services/peerMultiCheckoutTotals"
import { applyAcceptedOfferToPeerCheckoutListings } from "@/lib/services/applyAcceptedOfferToPeerCheckoutListings"
import { validateAcceptedOfferForPaymentIntent } from "@/lib/services/acceptedOfferCheckout"
import { dedupeIdsPreserveOrder } from "@/lib/stripe-marketplace-metadata"
import { isAnonymousSupabaseUser } from "@/lib/auth/is-anonymous-user"
import { isPeerListingSection } from "@/lib/peer-listing-sections"
import { getAuthEmailForUserId } from "@/lib/klaviyo/auth-user-email"
import {
  computeCheckoutTotalWithNewsletterPromo,
  validateNewsletterPromoForCheckout,
} from "@/lib/services/newsletterPromo"
import {
  reserveNewsletterPromoForPaymentIntent,
} from "@/lib/db/newsletterPromoCodes"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { normalizeNewsletterPromoCodeInput } from "@/lib/utils/newsletter-promo-code"

const JSON_NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
} as const

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    return NextResponse.json({ error: "Card payments are not configured" }, { status: 503 })
  }

  const keyConfigError = getStripeCheckoutKeyConfigError()
  if (keyConfigError) {
    return NextResponse.json({ error: keyConfigError }, { status: 503 })
  }

  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (isAnonymousSupabaseUser(user)) {
    return NextResponse.json(
      { error: "Create a Reswell account or sign in with email or Google to complete payment." },
      { status: 403 },
    )
  }

  const body = rawBody as {
    listing_id?: string
    listing_ids?: unknown
    fulfillment?: string | null
    address_id?: string | null
    offer_id?: string | null
    promo_code?: string | null
  }

  const fromArray = Array.isArray(body.listing_ids)
    ? dedupeIdsPreserveOrder(
        body.listing_ids.map((x) => (typeof x === "string" ? x.trim() : "")).filter((x) => UUID_RE.test(x)),
      )
    : []

  const listingIdsOrdered =
    fromArray.length > 0
      ? fromArray
      : body.listing_id?.trim() && UUID_RE.test(body.listing_id.trim())
        ? [body.listing_id.trim()]
        : []

  if (listingIdsOrdered.length === 0) {
    return NextResponse.json({ error: "Missing listing_id or listing_ids" }, { status: 400 })
  }

  const { data: listingsRows, error: listingsErr } = await supabase
    .from("listings")
    .select(PEER_SURFBOARD_CHECKOUT_LISTING_SELECT)
    .in("id", listingIdsOrdered)
    .in("status", ["active", "pending_sale"])
    .eq("hidden_from_site", false)
    .is("archived_at", null)

  if (listingsErr || !listingsRows?.length) {
    return NextResponse.json({ error: "Listing not found or not available" }, { status: 404 })
  }

  const listingMap = new Map<string, PeerSurfboardCheckoutListingRow>(
    listingsRows.map((row) => {
      const r = row as unknown as PeerSurfboardCheckoutListingRow
      return [r.id, r]
    }),
  )

  const listingsOrdered = listingIdsOrdered
    .map((id) => listingMap.get(id))
    .filter((row): row is PeerSurfboardCheckoutListingRow => row != null)

  if (listingsOrdered.length !== listingIdsOrdered.length) {
    return NextResponse.json({ error: "Listing not found or not available" }, { status: 404 })
  }

  if (listingsOrdered.some((l) => l.user_id === user.id)) {
    return NextResponse.json({ error: "Cannot purchase your own listing" }, { status: 400 })
  }

  const listingsForTotals = await applyAcceptedOfferToPeerCheckoutListings(
    supabase,
    user.id,
    listingsOrdered,
  )

  if (listingsOrdered.some((l) => !isPeerListingSection(l.section))) {
    return NextResponse.json({ error: "This listing cannot be purchased here" }, { status: 400 })
  }

  /** Multi-board payment intents must pull every listing from this buyer's cart (same seller),
   * unless paying via an accepted offer bundle (`offer_id`). */
  const offerIdParam = body.offer_id?.trim() || null
  let validatedOfferId: string | null = null

  if (listingIdsOrdered.length > 1) {
    if (offerIdParam) {
      const offerCheck = await validateAcceptedOfferForPaymentIntent(
        supabase,
        user.id,
        offerIdParam,
        listingIdsOrdered,
      )
      if (!offerCheck.ok) {
        return NextResponse.json({ error: offerCheck.error }, { status: 400 })
      }
      validatedOfferId = offerIdParam
    } else {
      const { data: cartRows, error: cartVerifyErr } = await supabase
        .from("cart_items")
        .select("listing_id")
        .eq("profile_id", user.id)
        .in("listing_id", listingIdsOrdered)

      if (cartVerifyErr) {
        return NextResponse.json({ error: "Could not verify cart" }, { status: 500 })
      }

      const inBuyerCart = new Set(
        (cartRows ?? []).map((r) => String((r as { listing_id?: string }).listing_id ?? "").trim()),
      )
      for (const id of listingIdsOrdered) {
        if (!inBuyerCart.has(id)) {
          return NextResponse.json(
            {
              error:
                "Checking out multiple boards together only works when every board is in your cart from the same seller, or when checking out an accepted offer bundle.",
            },
            { status: 400 },
          )
        }
      }
    }
  } else if (offerIdParam) {
    const offerCheck = await validateAcceptedOfferForPaymentIntent(
      supabase,
      user.id,
      offerIdParam,
      listingIdsOrdered,
    )
    if (!offerCheck.ok) {
      return NextResponse.json({ error: offerCheck.error }, { status: 400 })
    }
    validatedOfferId = offerIdParam
  }

  const bundleSellerId = listingsOrdered[0]!.user_id
  if (!listingsOrdered.every((l) => l.user_id === bundleSellerId)) {
    return NextResponse.json({ error: "All items must be from the same seller" }, { status: 400 })
  }

  if (listingsOrdered.some((l) => l.local_pickup === false && !l.shipping_available)) {
    return NextResponse.json({ error: "Listing has no fulfillment options" }, { status: 400 })
  }

  let impliedFulfillment: "pickup" | "shipping"

  if (listingsOrdered.length > 1) {
    if (body.fulfillment !== "pickup" && body.fulfillment !== "shipping") {
      return NextResponse.json(
        { error: "Choose pickup or shipping for this order" },
        { status: 400 },
      )
    }
    if (body.fulfillment === "pickup" && !listingsOrdered.every((l) => l.local_pickup !== false)) {
      return NextResponse.json(
        { error: "Every board in a multi-item pickup checkout must offer local pickup." },
        { status: 400 },
      )
    }
    if (body.fulfillment === "shipping" && !listingsOrdered.every((l) => !!l.shipping_available)) {
      return NextResponse.json(
        { error: "Every board in a multi-item shipped checkout must offer shipping." },
        { status: 400 },
      )
    }
    impliedFulfillment = body.fulfillment
  } else {
    const listingRow = listingsOrdered[0]!
    const lp = listingRow.local_pickup !== false
    const sa = !!listingRow.shipping_available
    if (!lp && !sa) {
      return NextResponse.json({ error: "Listing has no fulfillment options" }, { status: 400 })
    }

    const fulfillment =
      lp && sa ? (body.fulfillment === "shipping" || body.fulfillment === "pickup" ? body.fulfillment : null) : undefined

    if (lp && sa && !fulfillment) {
      return NextResponse.json({ error: "Choose pickup or shipping for this listing" }, { status: 400 })
    }

    impliedFulfillment =
      lp && sa ? (fulfillment === "shipping" ? "shipping" : "pickup") : !lp && sa ? "shipping" : "pickup"
  }

  const addressId = body.address_id?.trim() || null
  let buyerAddress: ProfileAddressRow | null = null
  if (impliedFulfillment === "shipping") {
    if (!addressId) {
      return NextResponse.json({ error: "Shipping address is required" }, { status: 400 })
    }
    const { data: addr, error: addrErr } = await supabase
      .from("addresses")
      .select("*")
      .eq("id", addressId)
      .eq("profile_id", user.id)
      .maybeSingle()
    if (addrErr || !addr) {
      return NextResponse.json({ error: "Invalid shipping address" }, { status: 400 })
    }
    buyerAddress = addr as ProfileAddressRow
  }

  const bundle = await computePeerMultiCheckoutUsd({
    supabase,
    listingsOrdered: listingsForTotals,
    fulfillment: impliedFulfillment,
    buyerAddress,
    diagnosticTagPrefix: "payment-intent",
  })

  if (!bundle.ok) {
    return NextResponse.json({ error: bundle.error }, { status: 422, headers: JSON_NO_STORE_HEADERS })
  }

  const promoCodeRaw = body.promo_code?.trim()
  const promoCodeNormalized = promoCodeRaw ? normalizeNewsletterPromoCodeInput(promoCodeRaw) : null

  if (promoCodeNormalized && validatedOfferId) {
    return NextResponse.json(
      { error: "Promo codes cannot be combined with accepted offer prices." },
      { status: 400, headers: JSON_NO_STORE_HEADERS },
    )
  }

  let promoDiscountUsd = 0
  let promoCodeId: string | null = null
  let promoDiscountPercent = 0

  if (promoCodeNormalized) {
    const buyerEmail = (await getAuthEmailForUserId(user.id)) ?? user.email?.trim() ?? ""
    if (!buyerEmail) {
      return NextResponse.json(
        { error: "Add an email to your account before using a promo code." },
        { status: 400, headers: JSON_NO_STORE_HEADERS },
      )
    }

    const promoCheck = await validateNewsletterPromoForCheckout({
      code: promoCodeNormalized,
      buyerEmail,
      itemSubtotalUsd: bundle.totalItemPriceUsd,
      shippingUsd: bundle.totalShippingUsd,
    })

    if (!promoCheck.ok) {
      return NextResponse.json({ error: promoCheck.error }, { status: 400, headers: JSON_NO_STORE_HEADERS })
    }

    promoDiscountUsd = promoCheck.discountUsd
    promoCodeId = promoCheck.promo.id
    promoDiscountPercent = promoCheck.discountPercent
  }

  const chargedTotalUsd =
    promoDiscountUsd > 0
      ? computeCheckoutTotalWithNewsletterPromo({
          itemSubtotalUsd: bundle.totalItemPriceUsd,
          shippingUsd: bundle.totalShippingUsd,
          discountPercent: promoDiscountPercent,
        }).totalUsd
      : bundle.totalUsd

  const amountCents = Math.round(chargedTotalUsd * 100)
  if (amountCents < 50) {
    return NextResponse.json({ error: "Amount is below the minimum charge" }, { status: 400 })
  }

  const primaryTitle = listingsOrdered[0]?.title ?? "listing"
  const stripeDescription =
    listingsOrdered.length > 1
      ? `Reswell — ${listingsOrdered.length} boards (${primaryTitle})`
      : `Reswell — ${primaryTitle}`

  try {
    const stripe = getStripe()
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      metadata: {
        listing_ids: listingIdsOrdered.join(","),
        listing_id: listingIdsOrdered[0]!,
        buyer_id: user.id,
        fulfillment: impliedFulfillment,
        amount_cents: String(amountCents),
        bundle_line_count: String(listingIdsOrdered.length),
        ...(validatedOfferId ? { offer_id: validatedOfferId } : {}),
        ...(addressId ? { address_id: addressId } : {}),
        ...(promoCodeId
          ? {
              promo_code_id: promoCodeId,
              promo_discount_cents: String(Math.round(promoDiscountUsd * 100)),
            }
          : {}),
        ...(bundle.anyUsedReswellQuote
          ? {
              reswell_shipping_cents: String(
                Math.round(
                  bundle.lines.filter((l) => l.usedReswellQuote).reduce((s, l) => s + l.shippingUsd, 0) * 100,
                ),
              ),
            }
          : {}),
      },
      description: stripeDescription.slice(0, 1000),
    })

    if (promoCodeId) {
      let serviceSupabase
      try {
        serviceSupabase = createServiceRoleClient()
      } catch {
        await stripe.paymentIntents.cancel(paymentIntent.id)
        return NextResponse.json(
          { error: "Could not reserve promo code." },
          { status: 503, headers: JSON_NO_STORE_HEADERS },
        )
      }

      const reserved = await reserveNewsletterPromoForPaymentIntent(
        serviceSupabase,
        promoCodeId,
        paymentIntent.id,
      )
      if (!reserved.ok) {
        await stripe.paymentIntents.cancel(paymentIntent.id)
        return NextResponse.json(
          { error: reserved.error ?? "This promo code is no longer available." },
          { status: 409, headers: JSON_NO_STORE_HEADERS },
        )
      }
    }

    return NextResponse.json(
      {
        clientSecret: paymentIntent.client_secret,
      },
      { headers: JSON_NO_STORE_HEADERS },
    )
  } catch (err: unknown) {
    const logPayload =
      err instanceof Stripe.errors.StripeError
        ? { type: err.type, code: err.code, message: err.message, statusCode: err.statusCode }
        : { message: String(err) }
    console.error("[create-payment-intent] Stripe API error:", logPayload)

    if (err instanceof Stripe.errors.StripeAuthenticationError) {
      return NextResponse.json(
        {
          error:
            "Payments are temporarily unavailable. Please try again later or contact support.",
        },
        { status: 503 },
      )
    }

    let publicMessage = "Could not create payment"
    let status = 500
    if (err instanceof Stripe.errors.StripeError) {
      publicMessage = err.message?.trim() || publicMessage
      status = typeof err.statusCode === "number" && err.statusCode >= 400 ? err.statusCode : 500
      if (/sk_(live|test)_/i.test(publicMessage) || /api key/i.test(publicMessage)) {
        publicMessage = "Could not start payment. Please try again or contact support."
      }
    }

    return NextResponse.json({ error: publicMessage }, { status })
  }
}
