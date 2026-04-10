import { randomUUID } from "node:crypto"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { getSellerEarnings, MARKETPLACE_FEE_PERCENT } from "@/lib/seller-fees"
import { resolvePayableAmount } from "@/lib/purchase-amount"
import { generatePickupCode } from "@/lib/order-status"
import { getAuthEmailForUserId } from "@/lib/klaviyo/auth-user-email"
import { trackKlaviyoBuyerOrderConfirmed } from "@/lib/klaviyo/track-buyer-order-confirmed"
import { trackKlaviyoSellerOrderConfirmed } from "@/lib/klaviyo/track-seller-order-confirmed"
import { postPurchaseThreadNotification } from "@/lib/purchase-thread-notification"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { listing_id, fulfillment } = await request.json()

  if (!listing_id) {
    return NextResponse.json({ error: "Missing listing_id" }, { status: 400 })
  }

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("id, user_id, title, price, section, shipping_available, local_pickup, shipping_price, status")
    .eq("id", listing_id)
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .single()

  if (listingError || !listing) {
    return NextResponse.json({ error: "Listing not found or not available" }, { status: 404 })
  }

  if (listing.user_id === user.id) {
    return NextResponse.json({ error: "Cannot purchase your own listing" }, { status: 400 })
  }

  const resolved = resolvePayableAmount(listing, fulfillment)
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: 400 })
  }

  const price = resolved.total
  const { marketplaceFee: platformFee, sellerEarnings } = getSellerEarnings(price, { cardPayment: false })

  const { data: buyerWallet } = await supabase
    .from("wallets")
    .select("*")
    .eq("user_id", user.id)
    .single()

  if (!buyerWallet || parseFloat(buyerWallet.balance) < price) {
    return NextResponse.json(
      { error: "Insufficient Reswell Bucks", balance: buyerWallet?.balance || 0 },
      { status: 400 }
    )
  }

  let serviceSupabase
  try {
    serviceSupabase = createServiceRoleClient()
  } catch {
    return NextResponse.json(
      { error: "Purchase could not be completed (server configuration)." },
      { status: 503 },
    )
  }

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
      console.error("[wallet/purchase] seller wallet insert:", walletInsertErr)
    }
    sellerWallet = newWallet
  }

  if (!sellerWallet) {
    return NextResponse.json({ error: "Seller wallet error" }, { status: 500 })
  }

  const newBuyerBalance = parseFloat(buyerWallet.balance) - price
  const newSellerBalance = parseFloat(sellerWallet.balance) + sellerEarnings

  const { error: buyerUpdateError } = await supabase
    .from("wallets")
    .update({
      balance: newBuyerBalance,
      lifetime_spent: parseFloat(buyerWallet.lifetime_spent) + price,
      updated_at: new Date().toISOString(),
    })
    .eq("id", buyerWallet.id)

  if (buyerUpdateError) {
    return NextResponse.json({ error: "Failed to process payment" }, { status: 500 })
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
    console.error("[wallet/purchase] seller wallet update:", sellerWalletUpdateErr)
    return NextResponse.json({ error: "Failed to credit seller" }, { status: 500 })
  }

  const isPickup = fulfillment === "pickup" || (!listing.shipping_available && listing.local_pickup !== false)
  const deliveryStatus = isPickup ? "pickup_ready" : "pending"
  const pickupCode = isPickup ? generatePickupCode() : null

  const { data: purchase, error: orderErr } = await serviceSupabase
    .from("orders")
    .insert({
      id: randomUUID(),
      listing_id: listing.id,
      buyer_id: user.id,
      seller_id: listing.user_id,
      amount: price,
      platform_fee: platformFee,
      seller_earnings: sellerEarnings,
      status: "confirmed",
      payment_method: "reswell_bucks",
      fulfillment_method: isPickup ? "pickup" : "shipping",
      delivery_status: deliveryStatus,
      pickup_code: pickupCode,
    })
    .select()
    .single()

  if (orderErr || !purchase) {
    console.error("[wallet/purchase] order insert:", orderErr)
    return NextResponse.json({ error: "Could not create order" }, { status: 500 })
  }

  const { error: buyerTxErr } = await supabase.from("wallet_transactions").insert({
    wallet_id: buyerWallet.id,
    user_id: user.id,
    type: "purchase",
    amount: -price,
    balance_after: newBuyerBalance,
    description: `Purchased "${listing.title}"${resolved.shipping > 0 ? ` (incl. shipping $${resolved.shipping.toFixed(2)})` : ""}`,
    reference_id: purchase.id,
    reference_type: "listing",
  })

  if (buyerTxErr) {
    console.error("[wallet/purchase] buyer wallet_transactions:", buyerTxErr)
    return NextResponse.json({ error: "Could not record purchase" }, { status: 500 })
  }

  const { error: sellerTxErr } = await serviceSupabase.from("wallet_transactions").insert({
    wallet_id: sellerWallet.id,
    user_id: listing.user_id,
    type: "sale",
    amount: sellerEarnings,
    balance_after: newSellerBalance,
    description: `Sold "${listing.title}" (${MARKETPLACE_FEE_PERCENT}% fee: $${platformFee.toFixed(2)})`,
    reference_id: purchase.id,
    reference_type: "listing",
  })

  if (sellerTxErr) {
    console.error("[wallet/purchase] seller wallet_transactions:", sellerTxErr)
    return NextResponse.json({ error: "Could not record sale" }, { status: 500 })
  }

  const { error: listingErr } = await serviceSupabase
    .from("listings")
    .update({ status: "sold" })
    .eq("id", listing.id)

  if (listingErr) {
    console.error("[wallet/purchase] listing update:", listingErr)
    return NextResponse.json({ error: "Could not mark listing sold" }, { status: 500 })
  }

  void postPurchaseThreadNotification(supabase, {
    buyerId: user.id,
    sellerId: listing.user_id,
    listingId: listing.id,
    listingTitle: listing.title,
    orderNum: formatOrderNumForCustomer(
      (purchase as { order_num?: string | null }).order_num,
      purchase.id,
    ),
    total: price,
    fulfillment: isPickup ? "pickup" : "shipping",
    shippingAddress: null,
  })

  if (purchase?.id) {
    const sellerEmail = await getAuthEmailForUserId(listing.user_id)
    await trackKlaviyoBuyerOrderConfirmed({
      buyerUserId: user.id,
      buyerEmail: user.email ?? null,
      orderId: purchase.id,
      orderNum: (purchase as { order_num?: string | null }).order_num ?? null,
      listingId: listing.id,
      listingTitle: listing.title,
      listingSection: listing.section,
      amount: price,
      fulfillmentMethod: isPickup ? "pickup" : "shipping",
      paymentMethod: "reswell_bucks",
    })
    if (user.id !== listing.user_id) {
      await trackKlaviyoSellerOrderConfirmed({
        sellerUserId: listing.user_id,
        sellerEmail,
        orderId: purchase.id,
        orderNum: (purchase as { order_num?: string | null }).order_num ?? null,
        listingId: listing.id,
        listingTitle: listing.title,
        listingSection: listing.section,
        orderAmount: price,
        sellerEarnings,
        platformFee,
        fulfillmentMethod: isPickup ? "pickup" : "shipping",
        paymentMethod: "reswell_bucks",
      })
    }
  }

  return NextResponse.json({
    success: true,
    purchase,
    newBalance: newBuyerBalance,
  })
}
