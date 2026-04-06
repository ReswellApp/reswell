import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { getStripe } from "@/lib/stripe-server"
import { resolvePayableAmount } from "@/lib/purchase-amount"
import { getSellerEarnings, MARKETPLACE_FEE_PERCENT } from "@/lib/seller-fees"
import {
  profileAddressToOrderShippingJson,
  type ProfileAddressRow,
} from "@/lib/profile-address"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    return NextResponse.json({ error: "Card payments are not configured" }, { status: 503 })
  }

  const body = (await request.json()) as { payment_intent_id?: string }
  const piId = body.payment_intent_id?.trim()
  if (!piId) {
    return NextResponse.json({ error: "Missing payment_intent_id" }, { status: 400 })
  }

  const stripe = getStripe()
  const pi = await stripe.paymentIntents.retrieve(piId)

  if (pi.status !== "succeeded") {
    return NextResponse.json({ error: "Payment is not complete yet" }, { status: 400 })
  }

  if (pi.metadata.buyer_id !== user.id) {
    return NextResponse.json({ error: "Invalid payment" }, { status: 403 })
  }

  const listingId = pi.metadata.listing_id?.trim()
  if (!listingId) {
    return NextResponse.json({ error: "Invalid payment metadata" }, { status: 400 })
  }

  const { data: existing } = await supabase
    .from("orders")
    .select("id")
    .eq("stripe_checkout_session_id", piId)
    .maybeSingle()

  if (existing?.id) {
    return NextResponse.json({ success: true, orderId: existing.id, alreadyProcessed: true })
  }

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select(
      "id, user_id, title, price, section, shipping_available, local_pickup, shipping_price, status",
    )
    .eq("id", listingId)
    .single()

  if (listingError || !listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 })
  }

  if (listing.user_id === user.id) {
    return NextResponse.json({ error: "Invalid purchase" }, { status: 400 })
  }

  if (listing.status !== "active") {
    return NextResponse.json(
      { error: "This listing is no longer available. Contact support if you were charged." },
      { status: 409 },
    )
  }

  const lp = listing.local_pickup !== false
  const sa = !!listing.shipping_available
  const fulfillmentMeta = pi.metadata.fulfillment
  const fulfillmentParam =
    lp && sa
      ? fulfillmentMeta === "shipping" || fulfillmentMeta === "pickup"
        ? fulfillmentMeta
        : null
      : undefined

  const resolved = resolvePayableAmount(listing, fulfillmentParam)
  if (!resolved.ok) {
    return NextResponse.json({ error: "Could not verify order" }, { status: 400 })
  }

  const expectedCents = Math.round(resolved.total * 100)
  if (pi.amount !== expectedCents) {
    return NextResponse.json({ error: "Payment amount does not match listing" }, { status: 400 })
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

  const fulfillmentMethod =
    lp && sa
      ? fulfillmentMeta === "shipping" || fulfillmentMeta === "pickup"
        ? fulfillmentMeta
        : null
      : !lp && sa
        ? "shipping"
        : "pickup"

  let shippingAddressJson: Record<string, unknown> | null = null
  const addressIdMeta = pi.metadata.address_id?.trim()
  if (fulfillmentMethod === "shipping" && addressIdMeta) {
    const { data: addrRow } = await supabase
      .from("addresses")
      .select("*")
      .eq("id", addressIdMeta)
      .eq("profile_id", user.id)
      .maybeSingle()
    if (addrRow) {
      shippingAddressJson = profileAddressToOrderShippingJson(
        addrRow as ProfileAddressRow,
        user.email ?? null,
      ) as Record<string, unknown>
    }
  }

  const { data: purchase, error: insertError } = await supabase
    .from("orders")
    .insert({
      listing_id: listing.id,
      buyer_id: user.id,
      seller_id: listing.user_id,
      amount: price,
      platform_fee: platformFee,
      seller_earnings: sellerEarnings,
      status: "confirmed",
      stripe_checkout_session_id: piId,
      fulfillment_method: fulfillmentMethod,
      ...(shippingAddressJson ? { shipping_address: shippingAddressJson } : {}),
    })
    .select()
    .single()

  if (insertError || !purchase) {
    return NextResponse.json({ error: "Could not create order" }, { status: 500 })
  }

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
    description: `Sold "${listing.title}" (${MARKETPLACE_FEE_PERCENT}% fee: $${platformFee.toFixed(2)}, card)`,
    reference_id: purchase.id,
    reference_type: "listing",
  })

  await supabase.from("listings").update({ status: "sold" }).eq("id", listing.id)

  return NextResponse.json({ success: true, orderId: purchase.id })
}
