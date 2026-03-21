import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { resolvePayableAmount } from "@/lib/purchase-amount"
import { getStripe } from "@/lib/stripe-server"
import { SURFBOARD_CHECKOUT_MODE } from "@/lib/checkout/surfboard-stripe-completion"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const listing_id = body.listing_id as string | undefined
  const fulfillment = body.fulfillment as string | undefined | null

  if (!listing_id) {
    return NextResponse.json({ error: "Missing listing_id" }, { status: 400 })
  }

  const stripe = getStripe()
  if (!stripe) {
    return NextResponse.json(
      {
        error: "Card payments are not configured",
        code: "stripe_not_configured",
      },
      { status: 503 }
    )
  }

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select(
      "id, user_id, title, price, section, status, shipping_available, local_pickup, shipping_price"
    )
    .eq("id", listing_id)
    .eq("status", "active")
    .single()

  if (listingError || !listing) {
    return NextResponse.json({ error: "Listing not found or not available" }, { status: 404 })
  }

  if (listing.section !== "surfboards") {
    return NextResponse.json(
      { error: "Card checkout for this listing type is not supported here" },
      { status: 400 }
    )
  }

  if (listing.user_id === user.id) {
    return NextResponse.json({ error: "Cannot purchase your own listing" }, { status: 400 })
  }

  const resolved = resolvePayableAmount(listing, fulfillment)
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: 400 })
  }

  const origin =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      price_data: {
        currency: "usd",
        product_data: {
          name: listing.title,
          description: "Surfboard — ReSwell marketplace",
        },
        unit_amount: Math.round(resolved.itemPrice * 100),
      },
      quantity: 1,
    },
  ]

  if (resolved.shipping > 0) {
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: {
          name: "Shipping",
          description: "Flat shipping (per listing)",
        },
        unit_amount: Math.round(resolved.shipping * 100),
      },
      quantity: 1,
    })
  }

  const expectedTotalCents = Math.round(resolved.total * 100)

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: lineItems,
    metadata: {
      mode: SURFBOARD_CHECKOUT_MODE,
      user_id: user.id,
      listing_id: listing.id,
      fulfillment: fulfillment ?? "",
      item_price: resolved.itemPrice.toFixed(2),
      shipping: resolved.shipping.toFixed(2),
      total_cents: String(expectedTotalCents),
    },
    success_url: `${origin}/boards/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/boards/${listing.id}/checkout?canceled=1`,
  })

  return NextResponse.json({ url: session.url })
}
