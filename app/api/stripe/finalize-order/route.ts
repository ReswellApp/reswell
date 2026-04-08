import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { getStripe } from "@/lib/stripe-server"
import type Stripe from "stripe"
import { resolvePayableAmount } from "@/lib/purchase-amount"
import { getSellerEarnings, MARKETPLACE_FEE_PERCENT } from "@/lib/seller-fees"
import {
  profileAddressToOrderShippingJson,
  type ProfileAddressRow,
} from "@/lib/profile-address"
import { generatePickupCode } from "@/lib/order-status"
import { trackKlaviyoBuyerOrderConfirmed } from "@/lib/klaviyo/track-buyer-order-confirmed"
import { postPurchaseThreadNotification } from "@/lib/purchase-thread-notification"

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

  let pi: Stripe.PaymentIntent
  try {
    const stripe = getStripe()
    pi = await stripe.paymentIntents.retrieve(piId)
  } catch (e) {
    console.error("[finalize-order] Stripe retrieve:", e)
    return NextResponse.json({ error: "Could not verify payment" }, { status: 502 })
  }

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

  let serviceSupabase
  try {
    serviceSupabase = createServiceRoleClient()
  } catch {
    return NextResponse.json(
      { error: "Checkout could not be completed (server configuration)." },
      { status: 503 },
    )
  }

  const { data: existing } = await serviceSupabase
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

  let { data: sellerWallet } = await serviceSupabase
    .from("wallets")
    .select("*")
    .eq("user_id", listing.user_id)
    .maybeSingle()

  if (!sellerWallet) {
    const { data: newWallet, error: walletInsertErr } = await serviceSupabase
      .from("wallets")
      .insert({ user_id: listing.user_id })
      .select()
      .single()
    if (walletInsertErr) {
      console.error("[finalize-order] seller wallet insert:", walletInsertErr)
    }
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

  const isPickup = fulfillmentMethod === "pickup"
  const deliveryStatus = isPickup ? "pickup_ready" : "pending"
  const pickupCode = isPickup ? generatePickupCode() : null

  const { data: purchase, error: insertError } = await serviceSupabase
    .from("orders")
    .insert({
      listing_id: listing.id,
      buyer_id: user.id,
      seller_id: listing.user_id,
      amount: price,
      platform_fee: platformFee,
      seller_earnings: sellerEarnings,
      status: "confirmed",
      payment_method: "stripe",
      stripe_checkout_session_id: piId,
      fulfillment_method: fulfillmentMethod,
      delivery_status: deliveryStatus,
      pickup_code: pickupCode,
      ...(shippingAddressJson ? { shipping_address: shippingAddressJson } : {}),
    })
    .select()
    .single()

  if (insertError || !purchase) {
    console.error("[finalize-order] order insert:", insertError)
    const msg = insertError?.message ?? ""
    const schemaStale =
      insertError?.code === "PGRST204" ||
      msg.includes("delivery_status") ||
      msg.includes("pickup_code") ||
      msg.includes("schema cache")
    if (schemaStale) {
      return NextResponse.json(
        {
          error:
            "Database is missing required order columns. Apply pending Supabase migrations (see supabase/migrations), then reload the schema in the Supabase dashboard if needed.",
        },
        { status: 503 },
      )
    }
    return NextResponse.json({ error: "Could not create order" }, { status: 500 })
  }

  const { error: sellerWalletUpdateErr } = await serviceSupabase
    .from("wallets")
    .update({
      balance: newSellerBalance,
      lifetime_earned: parseFloat(sellerWallet.lifetime_earned) + sellerEarnings,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sellerWallet.id)

  if (sellerWalletUpdateErr) {
    console.error("[finalize-order] seller wallet update:", sellerWalletUpdateErr)
    return NextResponse.json({ error: "Could not credit seller" }, { status: 500 })
  }

  const { error: txErr } = await serviceSupabase.from("wallet_transactions").insert({
    wallet_id: sellerWallet.id,
    user_id: listing.user_id,
    type: "sale",
    amount: sellerEarnings,
    balance_after: newSellerBalance,
    description: `Sold "${listing.title}" (${MARKETPLACE_FEE_PERCENT}% fee: $${platformFee.toFixed(2)}, card)`,
    reference_id: purchase.id,
    reference_type: "listing",
  })

  if (txErr) {
    console.error("[finalize-order] wallet_transactions:", txErr)
    return NextResponse.json({ error: "Could not record sale" }, { status: 500 })
  }

  const { error: listingErr } = await serviceSupabase
    .from("listings")
    .update({ status: "sold" })
    .eq("id", listing.id)

  if (listingErr) {
    console.error("[finalize-order] listing update:", listingErr)
    return NextResponse.json({ error: "Could not mark listing sold" }, { status: 500 })
  }

  void postPurchaseThreadNotification(supabase, {
    buyerId: user.id,
    sellerId: listing.user_id,
    listingId: listing.id,
    listingTitle: listing.title,
    total: price,
    fulfillment: isPickup ? "pickup" : "shipping",
    shippingAddress: shippingAddressJson,
  })

  void trackKlaviyoBuyerOrderConfirmed({
    buyerUserId: user.id,
    buyerEmail: user.email ?? null,
    orderId: purchase.id,
    listingId: listing.id,
    listingTitle: listing.title,
    listingSection: listing.section,
    amount: price,
    fulfillmentMethod: isPickup ? "pickup" : "shipping",
    paymentMethod: "stripe",
  })

  return NextResponse.json({ success: true, orderId: purchase.id })
}
