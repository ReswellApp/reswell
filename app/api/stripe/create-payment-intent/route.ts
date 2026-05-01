import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { getStripe, getStripeCheckoutKeyConfigError } from "@/lib/stripe-server"
import type { ProfileAddressRow } from "@/lib/profile-address"
import { fetchSellerShipFromLabelName } from "@/lib/db/sellerShipFromLabel"
import {
  computePeerCheckoutTotalsUsd,
  PEER_SURFBOARD_CHECKOUT_LISTING_SELECT,
} from "@/lib/services/peerListingShippingQuote"
import { isAnonymousSupabaseUser } from "@/lib/auth/is-anonymous-user"

const JSON_NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
} as const

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
    fulfillment?: string | null
    address_id?: string | null
  }
  const listingId = body.listing_id?.trim()
  if (!listingId) {
    return NextResponse.json({ error: "Missing listing_id" }, { status: 400 })
  }

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select(PEER_SURFBOARD_CHECKOUT_LISTING_SELECT)
    .eq("id", listingId)
    .in("status", ["active", "pending_sale"])
    .eq("hidden_from_site", false)
    .single()

  if (listingError || !listing) {
    return NextResponse.json({ error: "Listing not found or not available" }, { status: 404 })
  }

  /** Runtime select fragment loses Supabase's row inference; cast through `unknown` once. */
  const listingRow = listing as unknown as Parameters<typeof computePeerCheckoutTotalsUsd>[0]["listing"] & {
    id: string
    user_id: string
    section: string | null
    local_pickup: boolean | null
    shipping_available: boolean | null
    title: string | null
  }

  if (listingRow.user_id === user.id) {
    return NextResponse.json({ error: "Cannot purchase your own listing" }, { status: 400 })
  }

  if (listingRow.section !== "surfboards") {
    return NextResponse.json({ error: "This listing cannot be purchased here" }, { status: 400 })
  }

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

  const impliedFulfillment: "pickup" | "shipping" =
    lp && sa
      ? fulfillment === "shipping"
        ? "shipping"
        : "pickup"
      : !lp && sa
        ? "shipping"
        : "pickup"

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

  const sellerShipFromName =
    impliedFulfillment === "shipping"
      ? await fetchSellerShipFromLabelName(supabase, listingRow.user_id)
      : "Seller"

  const totals = await computePeerCheckoutTotalsUsd({
    listing: listingRow,
    fulfillment: impliedFulfillment,
    buyerAddress,
    diagnosticTag: `payment-intent:${listingRow.id}`,
    sellerShipFromName,
  })
  if (!totals.ok) {
    return NextResponse.json({ error: totals.error }, { status: 422, headers: JSON_NO_STORE_HEADERS })
  }

  const amountCents = Math.round(totals.totalUsd * 100)
  if (amountCents < 50) {
    return NextResponse.json({ error: "Amount is below the minimum charge" }, { status: 400 })
  }

  try {
    const stripe = getStripe()
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      metadata: {
        listing_id: listingRow.id,
        buyer_id: user.id,
        fulfillment: impliedFulfillment,
        amount_cents: String(amountCents),
        ...(addressId ? { address_id: addressId } : {}),
        ...(totals.usedReswellQuote
          ? { reswell_shipping_cents: String(Math.round(totals.shippingUsd * 100)) }
          : {}),
      },
      description: `Reswell — ${listingRow.title ?? "listing"}`.slice(0, 1000),
    })

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
