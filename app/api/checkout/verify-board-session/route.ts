import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { resolvePayableAmount } from "@/lib/purchase-amount"
import { getSellerEarnings, MARKETPLACE_FEE_PERCENT } from "@/lib/seller-fees"

const MODE = "surfboard_listing"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { session_id } = await request.json()
  if (!session_id || typeof session_id !== "string") {
    return NextResponse.json({ error: "Missing session_id" }, { status: 400 })
  }

  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) {
    return NextResponse.json({ error: "Card payments are not configured" }, { status: 503 })
  }

  const stripe = new Stripe(secret)
  const session = await stripe.checkout.sessions.retrieve(session_id)

  if (session.metadata?.mode !== MODE || session.metadata?.user_id !== user.id) {
    return NextResponse.json({ error: "Invalid checkout session" }, { status: 400 })
  }

  if (session.payment_status !== "paid") {
    return NextResponse.json({ error: "Payment not completed" }, { status: 400 })
  }

  const listingId = session.metadata.listing_id
  if (!listingId) {
    return NextResponse.json({ error: "Invalid session metadata" }, { status: 400 })
  }

  const fulfillment = session.metadata.fulfillment || null

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select(
      "id, user_id, title, price, section, status, shipping_available, local_pickup, shipping_price"
    )
    .eq("id", listingId)
    .single()

  if (listingError || !listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 })
  }

  const resolved = resolvePayableAmount(listing, fulfillment)
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: 400 })
  }

  const expectedCents = Math.round(resolved.total * 100)
  if (typeof session.amount_total !== "number" || session.amount_total !== expectedCents) {
    return NextResponse.json({ error: "Amount mismatch" }, { status: 400 })
  }

  const { data: existingPurchase } = await supabase
    .from("purchases")
    .select("id")
    .eq("listing_id", listing.id)
    .eq("buyer_id", user.id)
    .eq("status", "confirmed")
    .maybeSingle()

  if (existingPurchase) {
    return NextResponse.json({ success: true, duplicate: true, listing_id: listing.id })
  }

  if (listing.status !== "active") {
    return NextResponse.json(
      { error: "This listing is no longer available. If you were charged, contact support." },
      { status: 409 }
    )
  }

  const price = resolved.total
  const { marketplaceFee: platformFee, sellerEarnings } = getSellerEarnings(price, {
    cardPayment: true,
  })

  let { data: sellerWallet } = await supabase
    .from("wallets")
    .select("*")
    .eq("user_id", listing.user_id)
    .single()

  if (!sellerWallet) {
    const { data: newWallet } = await supabase
      .from("wallets")
      .insert({ user_id: listing.user_id })
      .select()
      .single()
    sellerWallet = newWallet
  }

  if (!sellerWallet) {
    return NextResponse.json({ error: "Seller wallet error" }, { status: 500 })
  }

  const newSellerBalance = parseFloat(sellerWallet.balance) + sellerEarnings

  const { data: purchase } = await supabase
    .from("purchases")
    .insert({
      listing_id: listing.id,
      buyer_id: user.id,
      seller_id: listing.user_id,
      amount: price,
      platform_fee: platformFee,
      seller_earnings: sellerEarnings,
      status: "confirmed",
    })
    .select()
    .single()

  await supabase
    .from("wallets")
    .update({
      balance: newSellerBalance,
      lifetime_earned: parseFloat(sellerWallet.lifetime_earned) + sellerEarnings,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sellerWallet.id)

  await supabase.from("wallet_transactions").insert({
    wallet_id: sellerWallet.id,
    user_id: listing.user_id,
    type: "sale",
    amount: sellerEarnings,
    balance_after: newSellerBalance,
    description: `Sold "${listing.title}" (card, ${MARKETPLACE_FEE_PERCENT}% + processing fee)`,
    reference_id: purchase?.id,
    reference_type: "listing",
  })

  await supabase.from("listings").update({ status: "sold" }).eq("id", listing.id)

  return NextResponse.json({ success: true, listing_id: listing.id })
}
