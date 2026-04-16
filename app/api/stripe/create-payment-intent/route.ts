import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { getStripe, getStripeCheckoutKeyConfigError } from "@/lib/stripe-server"
import type { ProfileAddressRow } from "@/lib/profile-address"
import { computePeerCheckoutTotalsUsd } from "@/lib/services/peerListingShippingQuote"

const LISTING_SELECT = `
  id,
  user_id,
  title,
  price,
  section,
  shipping_available,
  local_pickup,
  shipping_price,
  board_shipping_cost_mode,
  status,
  latitude,
  longitude,
  shipping_packed_length_in,
  shipping_packed_width_in,
  shipping_packed_height_in,
  shipping_packed_weight_oz,
  length_feet,
  length_inches,
  length_inches_display,
  width,
  width_inches_display,
  thickness,
  thickness_inches_display,
  volume,
  volume_display
`

export async function POST(request: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    return NextResponse.json({ error: "Card payments are not configured" }, { status: 503 })
  }

  const keyConfigError = getStripeCheckoutKeyConfigError()
  if (keyConfigError) {
    return NextResponse.json({ error: keyConfigError }, { status: 503 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await request.json()) as {
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
    .select(LISTING_SELECT)
    .eq("id", listingId)
    .in("status", ["active", "pending_sale"])
    .eq("hidden_from_site", false)
    .single()

  if (listingError || !listing) {
    return NextResponse.json({ error: "Listing not found or not available" }, { status: 404 })
  }

  if (listing.user_id === user.id) {
    return NextResponse.json({ error: "Cannot purchase your own listing" }, { status: 400 })
  }

  if (listing.section !== "surfboards") {
    return NextResponse.json({ error: "This listing cannot be purchased here" }, { status: 400 })
  }

  const lp = listing.local_pickup !== false
  const sa = !!listing.shipping_available
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

  const totals = await computePeerCheckoutTotalsUsd({
    listing: listing as Parameters<typeof computePeerCheckoutTotalsUsd>[0]["listing"],
    fulfillment: impliedFulfillment,
    buyerAddress,
  })
  if (!totals.ok) {
    return NextResponse.json({ error: totals.error }, { status: 422 })
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
        listing_id: listing.id,
        buyer_id: user.id,
        fulfillment: impliedFulfillment,
        amount_cents: String(amountCents),
        ...(addressId ? { address_id: addressId } : {}),
        ...(totals.usedReswellQuote
          ? { reswell_shipping_cents: String(Math.round(totals.shippingUsd * 100)) }
          : {}),
      },
      description: `Reswell — ${listing.title}`.slice(0, 1000),
    })

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
    })
  } catch (err: unknown) {
    const stripeErr = err as { type?: string; code?: string; message?: string; statusCode?: number }
    console.error("[create-payment-intent] Stripe API error:", {
      type: stripeErr.type,
      code: stripeErr.code,
      message: stripeErr.message,
      statusCode: stripeErr.statusCode,
    })
    return NextResponse.json(
      { error: stripeErr.message ?? "Could not create payment" },
      { status: stripeErr.statusCode ?? 500 },
    )
  }
}
