import type { SupabaseClient } from "@supabase/supabase-js"
import type Stripe from "stripe"
import { resolvePayableAmount } from "@/lib/purchase-amount"
import { getSellerEarnings, MARKETPLACE_FEE_PERCENT } from "@/lib/seller-fees"
import {
  sessionToShippingAddressRecord,
  surfboardCheckoutCollectsShipping,
} from "@/lib/stripe-shipping-address"

export const SURFBOARD_CHECKOUT_MODE = "surfboard_listing"

type Result =
  | { ok: true; duplicate?: boolean; listing_id?: string }
  | { ok: false; error: string }

/**
 * Fulfill a paid surfboard Checkout Session: purchase row, seller wallet credit, listing sold.
 * Call only after payment is confirmed (success page or webhook).
 */
export async function completeSurfboardCheckoutFromSession(
  supabase: SupabaseClient,
  session: Stripe.Checkout.Session,
  options: { assertBuyerId?: string }
): Promise<Result> {
  if (session.metadata?.mode !== SURFBOARD_CHECKOUT_MODE) {
    return { ok: false, error: "Invalid session mode" }
  }

  const buyerId = session.metadata.user_id
  if (!buyerId) {
    return { ok: false, error: "Missing buyer" }
  }

  if (options.assertBuyerId && options.assertBuyerId !== buyerId) {
    return { ok: false, error: "Session does not belong to this user" }
  }

  if (session.payment_status !== "paid") {
    return { ok: false, error: "Payment not completed" }
  }

  const listingId = session.metadata.listing_id
  if (!listingId) {
    return { ok: false, error: "Missing listing" }
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
    return { ok: false, error: "Listing not found" }
  }

  const resolved = resolvePayableAmount(listing, fulfillment)
  if (!resolved.ok) {
    return { ok: false, error: resolved.error }
  }

  const expectedCents = Math.round(resolved.total * 100)
  if (typeof session.amount_total !== "number" || session.amount_total !== expectedCents) {
    return { ok: false, error: "Amount mismatch" }
  }

  const { data: existingPurchase } = await supabase
    .from("purchases")
    .select("id")
    .eq("listing_id", listing.id)
    .eq("buyer_id", buyerId)
    .eq("status", "confirmed")
    .maybeSingle()

  if (existingPurchase) {
    return { ok: true, duplicate: true, listing_id: listing.id }
  }

  if (listing.status !== "active") {
    return {
      ok: false,
      error:
        "This listing is no longer available. If you were charged, contact support with your receipt.",
    }
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
    return { ok: false, error: "Seller wallet error" }
  }

  const newSellerBalance = parseFloat(String(sellerWallet.balance)) + sellerEarnings

  const collectShipping = surfboardCheckoutCollectsShipping(listing, fulfillment)
  const shippingPayload = collectShipping ? sessionToShippingAddressRecord(session) : null
  if (collectShipping && !shippingPayload) {
    return {
      ok: false,
      error:
        "Stripe did not return a shipping address. If you were charged, contact support with your receipt.",
    }
  }

  const { data: purchase, error: purchaseInsertError } = await supabase
    .from("purchases")
    .insert({
      listing_id: listing.id,
      buyer_id: buyerId,
      seller_id: listing.user_id,
      amount: price,
      platform_fee: platformFee,
      seller_earnings: sellerEarnings,
      status: "confirmed",
      shipping_address: shippingPayload,
      stripe_checkout_session_id: session.id,
    })
    .select()
    .single()

  if (purchaseInsertError) {
    console.error("[surfboard checkout] purchase insert failed:", purchaseInsertError)
    return {
      ok: false,
      error:
        "Could not save your purchase. If you just added shipping columns, run scripts/015_purchases_shipping_address.sql in Supabase. Otherwise contact support with your receipt.",
    }
  }

  await supabase
    .from("wallets")
    .update({
      balance: newSellerBalance,
      lifetime_earned: parseFloat(String(sellerWallet.lifetime_earned)) + sellerEarnings,
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

  return { ok: true, listing_id: listing.id }
}
