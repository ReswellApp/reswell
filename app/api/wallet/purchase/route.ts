import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

const PLATFORM_FEE_PERCENT = 5 // 5% platform fee

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

  // Fetch the listing
  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("*")
    .eq("id", listing_id)
    .eq("status", "active")
    .single()

  if (listingError || !listing) {
    return NextResponse.json({ error: "Listing not found or not available" }, { status: 404 })
  }

  if (listing.user_id === user.id) {
    return NextResponse.json({ error: "Cannot purchase your own listing" }, { status: 400 })
  }

  const price = parseFloat(listing.price)
  const platformFee = Math.round(price * PLATFORM_FEE_PERCENT) / 100
  const sellerEarnings = price - platformFee

  // Fetch buyer wallet
  const { data: buyerWallet } = await supabase
    .from("wallets")
    .select("*")
    .eq("user_id", user.id)
    .single()

  if (!buyerWallet || parseFloat(buyerWallet.balance) < price) {
    return NextResponse.json(
      { error: "Insufficient ReSwell bucks", balance: buyerWallet?.balance || 0 },
      { status: 400 }
    )
  }

  // Fetch seller wallet (or create)
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

  const newBuyerBalance = parseFloat(buyerWallet.balance) - price
  const newSellerBalance = parseFloat(sellerWallet.balance) + sellerEarnings

  // Update buyer wallet
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

  // Update seller wallet
  await supabase
    .from("wallets")
    .update({
      balance: newSellerBalance,
      lifetime_earned: parseFloat(sellerWallet.lifetime_earned) + sellerEarnings,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sellerWallet.id)

  // Create purchase record
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

  // Create buyer transaction
  await supabase.from("wallet_transactions").insert({
    wallet_id: buyerWallet.id,
    user_id: user.id,
    type: "purchase",
    amount: -price,
    balance_after: newBuyerBalance,
    description: `Purchased "${listing.title}"`,
    reference_id: purchase?.id,
    reference_type: "listing",
  })

  // Create seller transaction
  await supabase.from("wallet_transactions").insert({
    wallet_id: sellerWallet.id,
    user_id: listing.user_id,
    type: "sale",
    amount: sellerEarnings,
    balance_after: newSellerBalance,
    description: `Sold "${listing.title}" (${PLATFORM_FEE_PERCENT}% fee: R$${platformFee.toFixed(2)})`,
    reference_id: purchase?.id,
    reference_type: "listing",
  })

  // Mark listing as sold
  await supabase
    .from("listings")
    .update({ status: "sold" })
    .eq("id", listing.id)

  return NextResponse.json({
    success: true,
    purchase,
    newBalance: newBuyerBalance,
  })
}
