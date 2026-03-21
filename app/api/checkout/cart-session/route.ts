import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { getStripe } from "@/lib/stripe-server"
import { CART_CHECKOUT_MODE } from "@/lib/checkout/cart-stripe-completion"
import { getCheckoutAppOrigin } from "@/lib/checkout-app-origin"
import { STRIPE_CHECKOUT_SHIPPING_COUNTRIES } from "@/lib/stripe-shipping-address"

const SHIPPING_FLAT_CENTS = 999 // $9.99
const FREE_SHIPPING_THRESHOLD_CENTS = 5000 // $50

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const items = body.items as Array<{ id: string; name: string; price: number; quantity: number }> | undefined

  if (!items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 })
  }

  const stripe = getStripe()
  if (!stripe) {
    return NextResponse.json(
      { error: "Card payments are not configured", code: "stripe_not_configured" },
      { status: 503 }
    )
  }

  // Validate listings and stock
  for (const row of items) {
    const { data: listing } = await supabase
      .from("listings")
      .select("id, user_id, section, status")
      .eq("id", row.id)
      .single()

    if (!listing) {
      return NextResponse.json(
        { error: `Listing not found: ${row.id}` },
        { status: 404 }
      )
    }
    if (listing.user_id === user.id) {
      return NextResponse.json(
        { error: "Cannot purchase your own listing" },
        { status: 400 }
      )
    }
    if (listing.section !== "new" || listing.status !== "active") {
      return NextResponse.json(
        { error: `Listing not available for purchase: ${row.name}` },
        { status: 400 }
      )
    }

    const { data: inv } = await supabase
      .from("inventory")
      .select("quantity")
      .eq("listing_id", row.id)
      .single()

    const stock = inv ? Number(inv.quantity) : 0
    if (stock < row.quantity) {
      return NextResponse.json(
        { error: `Not enough stock for "${row.name}" (${row.quantity} requested, ${stock} available)` },
        { status: 400 }
      )
    }
  }

  const subtotalCents = items.reduce(
    (sum, i) => sum + Math.round(Number(i.price) * 100) * i.quantity,
    0
  )
  const shippingCents =
    subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS ? 0 : SHIPPING_FLAT_CENTS
  const totalCents = subtotalCents + shippingCents

  const subtotal = subtotalCents / 100
  const shipping = shippingCents / 100
  const total = totalCents / 100

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      user_id: user.id,
      status: "pending",
      subtotal,
      shipping,
      tax: 0,
      total,
    })
    .select("id")
    .single()

  if (orderError || !order) {
    console.error("Order insert failed", orderError)
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 }
    )
  }

  const orderItems = items.map((i) => ({
    order_id: order.id,
    listing_id: i.id,
    quantity: i.quantity,
    price: Number(i.price),
  }))

  const { error: itemsError } = await supabase.from("order_items").insert(orderItems)

  if (itemsError) {
    console.error("Order items insert failed", itemsError)
    return NextResponse.json(
      { error: "Failed to create order items" },
      { status: 500 }
    )
  }

  const origin = getCheckoutAppOrigin()
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map(
    (i) => ({
      price_data: {
        currency: "usd",
        product_data: {
          name: i.name,
          description: "Reswell marketplace",
        },
        unit_amount: Math.round(Number(i.price) * 100),
      },
      quantity: i.quantity,
    })
  )

  if (shippingCents > 0) {
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: {
          name: "Shipping",
          description: "Standard shipping",
        },
        unit_amount: shippingCents,
      },
      quantity: 1,
    })
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: lineItems,
    shipping_address_collection: {
      allowed_countries: STRIPE_CHECKOUT_SHIPPING_COUNTRIES,
    },
    phone_number_collection: { enabled: true },
    metadata: {
      order_id: order.id,
      mode: CART_CHECKOUT_MODE,
      user_id: user.id,
    },
    success_url: `${origin}/shop/checkout/success?order_id=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/shop/checkout?canceled=1`,
  })

  return NextResponse.json({ url: session.url, orderId: order.id })
}
