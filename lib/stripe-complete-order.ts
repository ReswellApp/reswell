import { randomUUID } from "node:crypto"
import { createServiceRoleClient } from "@/lib/supabase/server"
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

export type StripeCompleteOrderResult =
  | { ok: true; orderId: string; alreadyProcessed?: boolean }
  | { ok: false; error: string; status: number }

function isUniqueViolation(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false
  if (err.code === "23505") return true
  return Boolean(err.message?.toLowerCase().includes("duplicate"))
}

async function buyerEmailForKlaviyo(buyerId: string): Promise<string | null> {
  try {
    const admin = createServiceRoleClient()
    const { data, error } = await admin.auth.admin.getUserById(buyerId)
    if (error || !data?.user?.email) return null
    return data.user.email
  } catch {
    return null
  }
}

/**
 * Creates the marketplace order and side effects for a succeeded PaymentIntent.
 * Idempotent: safe to call from the client finalize route and from Stripe webhooks.
 * Caller must only invoke when `pi.status === "succeeded"` and metadata is trusted (Stripe-signed webhook or session matches buyer_id).
 */
export async function completeMarketplaceOrderFromPaymentIntent(
  pi: Stripe.PaymentIntent,
): Promise<StripeCompleteOrderResult> {
  const piId = pi.id

  let serviceSupabase
  try {
    serviceSupabase = createServiceRoleClient()
  } catch {
    return {
      ok: false,
      error: "Checkout could not be completed (server configuration).",
      status: 503,
    }
  }

  const { data: existing } = await serviceSupabase
    .from("orders")
    .select("id")
    .eq("stripe_checkout_session_id", piId)
    .maybeSingle()

  if (existing?.id) {
    return { ok: true, orderId: existing.id, alreadyProcessed: true }
  }

  const buyerId = pi.metadata.buyer_id?.trim()
  if (!buyerId) {
    return { ok: false, error: "Invalid payment metadata", status: 400 }
  }

  const listingId = pi.metadata.listing_id?.trim()
  if (!listingId) {
    return { ok: false, error: "Invalid payment metadata", status: 400 }
  }

  const buyerEmail = await buyerEmailForKlaviyo(buyerId)

  const { data: listing, error: listingError } = await serviceSupabase
    .from("listings")
    .select(
      "id, user_id, title, price, section, shipping_available, local_pickup, shipping_price, status",
    )
    .eq("id", listingId)
    .single()

  if (listingError || !listing) {
    return { ok: false, error: "Listing not found", status: 404 }
  }

  if (listing.user_id === buyerId) {
    return { ok: false, error: "Invalid purchase", status: 400 }
  }

  if (listing.status !== "active") {
    return {
      ok: false,
      error: "This listing is no longer available. Contact support if you were charged.",
      status: 409,
    }
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
    return { ok: false, error: "Could not verify order", status: 400 }
  }

  const expectedCents = Math.round(resolved.total * 100)
  if (pi.amount !== expectedCents) {
    return { ok: false, error: "Payment amount does not match listing", status: 400 }
  }

  const price = resolved.total
  const { marketplaceFee: platformFee, sellerEarnings } = getSellerEarnings(price, {
    cardPayment: true,
  })

  if (!Number.isFinite(sellerEarnings) || sellerEarnings < 0) {
    console.error("[stripe-complete-order] invalid seller_earnings", {
      price,
      platformFee,
      sellerEarnings,
      listingId: listing.id,
    })
    return {
      ok: false,
      error:
        "Order total is too low after card processing fees for the system to record this sale. Refund from Stripe if needed.",
      status: 500,
    }
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
      console.error("[stripe-complete-order] seller wallet insert:", walletInsertErr)
    }
    sellerWallet = newWallet
  }

  if (!sellerWallet) {
    return { ok: false, error: "Seller wallet error", status: 500 }
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
    const { data: addrRow } = await serviceSupabase
      .from("addresses")
      .select("*")
      .eq("id", addressIdMeta)
      .eq("profile_id", buyerId)
      .maybeSingle()
    if (addrRow) {
      shippingAddressJson = profileAddressToOrderShippingJson(
        addrRow as ProfileAddressRow,
        buyerEmail,
      ) as Record<string, unknown>
    }
  }

  const isPickup = fulfillmentMethod === "pickup"
  const deliveryStatus = isPickup ? "pickup_ready" : "pending"
  const pickupCode = isPickup ? generatePickupCode() : null

  const orderId = randomUUID()

  const { data: purchase, error: insertError } = await serviceSupabase
    .from("orders")
    .insert({
      id: orderId,
      listing_id: listing.id,
      buyer_id: buyerId,
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
    if (isUniqueViolation(insertError)) {
      const { data: raced } = await serviceSupabase
        .from("orders")
        .select("id")
        .eq("stripe_checkout_session_id", piId)
        .maybeSingle()
      if (raced?.id) {
        return { ok: true, orderId: raced.id, alreadyProcessed: true }
      }
    }
    console.error(
      "[stripe-complete-order] order insert:",
      insertError
        ? JSON.stringify(
            {
              message: insertError.message,
              code: insertError.code,
              details: insertError.details,
              hint: insertError.hint,
            },
            null,
            2,
          )
        : "no row returned",
    )
    const msg = insertError?.message ?? ""
    const schemaStale =
      insertError?.code === "PGRST204" ||
      msg.includes("delivery_status") ||
      msg.includes("pickup_code") ||
      msg.includes("schema cache")
    if (schemaStale) {
      return {
        ok: false,
        error:
          "Database is missing required order columns. Apply pending Supabase migrations (see supabase/migrations), then reload the schema in the Supabase dashboard if needed.",
        status: 503,
      }
    }
    return { ok: false, error: "Could not create order", status: 500 }
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
    console.error("[stripe-complete-order] seller wallet update:", sellerWalletUpdateErr)
    return { ok: false, error: "Could not credit seller", status: 500 }
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
    console.error("[stripe-complete-order] wallet_transactions:", txErr)
    return { ok: false, error: "Could not record sale", status: 500 }
  }

  const { error: listingErr } = await serviceSupabase
    .from("listings")
    .update({ status: "sold" })
    .eq("id", listing.id)

  if (listingErr) {
    console.error("[stripe-complete-order] listing update:", listingErr)
    return { ok: false, error: "Could not mark listing sold", status: 500 }
  }

  void postPurchaseThreadNotification(serviceSupabase, {
    buyerId,
    sellerId: listing.user_id,
    listingId: listing.id,
    listingTitle: listing.title,
    total: price,
    fulfillment: isPickup ? "pickup" : "shipping",
    shippingAddress: shippingAddressJson,
  })

  void trackKlaviyoBuyerOrderConfirmed({
    buyerUserId: buyerId,
    buyerEmail,
    orderId: purchase.id,
    listingId: listing.id,
    listingTitle: listing.title,
    listingSection: listing.section,
    listingSlug: null,
    amount: price,
    fulfillmentMethod: isPickup ? "pickup" : "shipping",
    paymentMethod: "stripe",
  })

  return { ok: true, orderId: purchase.id }
}

export async function retrieveSucceededPaymentIntent(
  paymentIntentId: string,
): Promise<
  | { ok: true; paymentIntent: Stripe.PaymentIntent }
  | { ok: false; error: string; status: number }
> {
  try {
    const stripe = getStripe()
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId.trim())
    if (pi.status !== "succeeded") {
      return { ok: false, error: "Payment is not complete yet", status: 400 }
    }
    return { ok: true, paymentIntent: pi }
  } catch (e) {
    console.error("[stripe-complete-order] Stripe retrieve:", e)
    return { ok: false, error: "Could not verify payment", status: 502 }
  }
}
