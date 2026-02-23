import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { listing_id } = await request.json()

  if (!listing_id) {
    return NextResponse.json({ error: "Missing listing_id" }, { status: 400 })
  }

  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) {
    return NextResponse.json(
      { error: "Card payments are not configured" },
      { status: 503 }
    )
  }

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("id, title, price, user_id, status")
    .eq("id", listing_id)
    .eq("status", "active")
    .single()

  if (listingError || !listing) {
    return NextResponse.json({ error: "Listing not found or not available" }, { status: 404 })
  }

  if (listing.user_id === user.id) {
    return NextResponse.json({ error: "Cannot purchase your own listing" }, { status: 400 })
  }

  const priceCents = Math.round(parseFloat(listing.price) * 100)
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")

  const stripe = new Stripe(secret)

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card", "apple_pay"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: listing.title,
            description: "ReSwell Surf marketplace purchase",
            images: undefined,
          },
          unit_amount: priceCents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      listing_id: listing.id,
      buyer_id: user.id,
      seller_id: listing.user_id,
    },
    success_url: `${origin}/dashboard/orders?paid=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/dashboard/orders?canceled=1`,
  })

  return NextResponse.json({ url: session.url })
}
