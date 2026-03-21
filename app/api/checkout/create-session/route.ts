import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { resolvePayableAmount } from "@/lib/purchase-amount"
import { getStripe } from "@/lib/stripe-server"
import { SURFBOARD_CHECKOUT_MODE } from "@/lib/checkout/surfboard-stripe-completion"
import { getCheckoutAppOrigin } from "@/lib/checkout-app-origin"

function safeProductName(title: string | null | undefined): string {
  const t = (title ?? "").trim() || "Surfboard listing"
  return t.length > 250 ? `${t.slice(0, 247)}…` : t
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let body: { listing_id?: string; fulfillment?: string | null }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const listing_id = body.listing_id
    const fulfillment = body.fulfillment

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

    const origin = getCheckoutAppOrigin()

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: safeProductName(listing.title),
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

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe did not return a checkout URL" },
        { status: 502 }
      )
    }

    return NextResponse.json({ url: session.url })
  } catch (e: unknown) {
    console.error("[create-session]", e)
    if (e instanceof Stripe.errors.StripeError) {
      const sc = e.statusCode
      const status =
        typeof sc === "number" && sc >= 400 && sc < 600 ? sc : 502
      return NextResponse.json(
        {
          error: e.message || "Stripe rejected the request",
          code: "stripe_error",
          stripe_code: e.code,
        },
        { status }
      )
    }
    const message = e instanceof Error ? e.message : "Checkout failed"
    return NextResponse.json({ error: message, code: "checkout_error" }, { status: 500 })
  }
}
