import { randomUUID } from "node:crypto"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { getStripe } from "@/lib/stripe-server"
import type Stripe from "stripe"
import { deleteBuyerCartRowsForListings } from "@/lib/db/cart-items-server"
import {
  PEER_SURFBOARD_CHECKOUT_LISTING_SELECT,
  type PeerSurfboardCheckoutListingRow,
} from "@/lib/services/peerListingShippingQuote"
import { computePeerMultiCheckoutUsd } from "@/lib/services/peerMultiCheckoutTotals"
import { applyAcceptedOfferToPeerCheckoutListings } from "@/lib/services/applyAcceptedOfferToPeerCheckoutListings"
import { pendingSaleFeeClause } from "@/lib/seller-fees"
import { marketplaceListingIdsFromPaymentIntent } from "@/lib/stripe-marketplace-metadata"
import {
  profileAddressToOrderShippingJson,
  type ProfileAddressRow,
} from "@/lib/profile-address"
import { generatePickupCode } from "@/lib/order-status"
import { getAuthEmailForUserId } from "@/lib/klaviyo/auth-user-email"
import { trackKlaviyoBuyerOrderConfirmed } from "@/lib/klaviyo/track-buyer-order-confirmed"
import type { KlaviyoBuyerOrderLineItem } from "@/lib/klaviyo/track-buyer-order-confirmed"
import { trackMetaPurchaseServerEvent } from "@/lib/meta/track-purchase-server-event"
import { postPurchaseThreadNotification } from "@/lib/purchase-thread-notification"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import { markUserListingBoardModelDataSold } from "@/lib/db/user-listing-board-model-data"
import { purchaseReswellShippingLabelAfterCheckout } from "@/lib/services/autoPurchaseReswellShippingLabelForOrder"
import { syncListingToGoogleMerchantBestEffort } from "@/lib/services/googleMerchantSync"
import { revalidateBoardsBrowseCatalog } from "@/lib/cache/revalidate-boards-browse-catalog"
import { revalidateSellersAfterListingChange } from "@/lib/cache/revalidate-sellers-directory-catalog"
import { revalidateMarketplaceSoldFeedCatalog } from "@/lib/cache/revalidate-marketplace-sold-feed"
import { completeAcceptedOfferOnPurchase } from "@/lib/services/completeOfferOnPurchase"

export type StripeCompleteOrderResult =
  | { ok: true; orderId: string; alreadyProcessed?: boolean }
  | { ok: false; error: string; status: number }

function isUniqueViolation(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false
  if (err.code === "23505") return true
  return Boolean(err.message?.toLowerCase().includes("duplicate"))
}

/** Keep wallet_transactions.description within typical DB limits (long listing titles). */
function walletPendingSaleDescription(listingTitle: string, platformFeeUsd: number): string {
  const safeTitle =
    listingTitle.length > 400 ? `${listingTitle.slice(0, 399)}…` : listingTitle
  const raw = `Pending — Sold "${safeTitle}" (${pendingSaleFeeClause(platformFeeUsd)}, card — available after delivery)`
  return raw.length > 2000 ? `${raw.slice(0, 1999)}…` : raw
}

/**
 * If the order row was committed but wallet_transactions insert failed (e.g. transient DB error),
 * a retry would previously return "already processed" without ever creating the ledger row.
 * Inserts only the missing activity row; wallet balances were already updated on the first attempt.
 */
async function recoverMissingOrderPendingLedger(
  serviceSupabase: ReturnType<typeof createServiceRoleClient>,
  orderId: string,
  buyerIdFromPi: string,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const { data: orderRow, error: orderErr } = await serviceSupabase
    .from("orders")
    .select("id, buyer_id, seller_id, listing_id, seller_earnings, platform_fee")
    .eq("id", orderId)
    .maybeSingle()

  if (orderErr || !orderRow) {
    return { ok: false, error: "Could not load order for recovery", status: 500 }
  }

  if (!buyerIdFromPi.trim() || orderRow.buyer_id !== buyerIdFromPi) {
    return { ok: false, error: "Invalid payment", status: 403 }
  }

  const { data: existingLedger } = await serviceSupabase
    .from("wallet_transactions")
    .select("id")
    .eq("reference_type", "order_pending_earnings")
    .eq("reference_id", orderId)
    .maybeSingle()

  if (existingLedger?.id) {
    return { ok: true }
  }

  const { data: listing } = await serviceSupabase
    .from("listings")
    .select("id, title, user_id")
    .eq("id", orderRow.listing_id)
    .maybeSingle()

  if (!listing || listing.user_id !== orderRow.seller_id) {
    return { ok: false, error: "Could not recover pending sale", status: 500 }
  }

  const { data: sellerWallet } = await serviceSupabase
    .from("wallets")
    .select("*")
    .eq("user_id", orderRow.seller_id)
    .maybeSingle()

  if (!sellerWallet) {
    return { ok: false, error: "Seller wallet error", status: 500 }
  }

  const sellerEarnings = parseFloat(String(orderRow.seller_earnings ?? 0))
  const platformFee = parseFloat(String(orderRow.platform_fee ?? 0))
  const prevAvailable = parseFloat(String(sellerWallet.balance ?? 0))

  const { error: insertErr } = await serviceSupabase.from("wallet_transactions").insert({
    wallet_id: sellerWallet.id,
    user_id: orderRow.seller_id,
    type: "sale",
    amount: sellerEarnings,
    balance_after: prevAvailable.toFixed(2),
    description: walletPendingSaleDescription(String(listing.title ?? ""), platformFee),
    reference_id: String(orderId),
    reference_type: "order_pending_earnings",
  })

  if (insertErr) {
    if (isUniqueViolation(insertErr)) {
      return { ok: true }
    }
    console.error("[stripe-complete-order] recover pending wallet_transactions:", insertErr)
    return { ok: false, error: "Could not record pending sale", status: 500 }
  }

  return { ok: true }
}

/**
 * Re-send Purchase Successful for an order already stored (idempotent finalize / webhook).
 * Seller Sale Successful Klaviyo fires when earnings are released after fulfillment.
 */
async function emitPurchaseSuccessfulKlaviyoForOrderId(
  serviceSupabase: ReturnType<typeof createServiceRoleClient>,
  orderId: string,
): Promise<void> {
  const { data: order } = await serviceSupabase
    .from("orders")
    .select(
      "id, order_num, buyer_id, seller_id, listing_id, amount, fulfillment_method, payment_method, pickup_code",
    )
    .eq("id", orderId)
    .maybeSingle()

  if (!order?.seller_id || !order.listing_id) return

  const { data: listing } = await serviceSupabase
    .from("listings")
    .select("id, title, section, slug")
    .eq("id", order.listing_id)
    .maybeSingle()

  if (!listing) return

  const buyerEmail = order.buyer_id != null ? await getAuthEmailForUserId(order.buyer_id) : null
  const rawAmount = order.amount as unknown
  const amount =
    typeof rawAmount === "number"
      ? rawAmount
      : parseFloat(typeof rawAmount === "string" ? rawAmount : String(rawAmount))

  const fulfillmentMethod =
    order.fulfillment_method === "pickup" ? "pickup" : "shipping"
  const paymentMethod =
    order.payment_method === "reswell_bucks" ? "reswell_bucks" : "stripe"

  await trackKlaviyoBuyerOrderConfirmed({
    buyerUserId: order.buyer_id ?? undefined,
    buyerEmail,
    orderId: order.id,
    orderNum: (order as { order_num?: string | null }).order_num ?? null,
    listingId: listing.id,
    listingTitle: listing.title ?? "",
    listingSection: listing.section ?? "",
    listingSlug: listing.slug ?? null,
    amount: Number.isFinite(amount) ? amount : 0,
    fulfillmentMethod,
    pickupCode: (order as { pickup_code?: string | null }).pickup_code ?? null,
    paymentMethod,
  })

  // Seller "Sale Successful" Klaviyo fires when earnings are released after fulfillment (see releaseOrderSellerEarningsAfterFulfillment).
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
    const { data: pendingLedger } = await serviceSupabase
      .from("wallet_transactions")
      .select("id")
      .eq("reference_type", "order_pending_earnings")
      .eq("reference_id", existing.id)
      .maybeSingle()

    if (pendingLedger?.id) {
      await emitPurchaseSuccessfulKlaviyoForOrderId(serviceSupabase, existing.id)
      await purchaseReswellShippingLabelAfterCheckout(serviceSupabase, existing.id)
      return { ok: true, orderId: existing.id, alreadyProcessed: true }
    }

    const recovered = await recoverMissingOrderPendingLedger(
      serviceSupabase,
      existing.id,
      pi.metadata.buyer_id?.trim() ?? "",
    )
    if (!recovered.ok) {
      return recovered
    }
    await emitPurchaseSuccessfulKlaviyoForOrderId(serviceSupabase, existing.id)
    await purchaseReswellShippingLabelAfterCheckout(serviceSupabase, existing.id)
    return { ok: true, orderId: existing.id, alreadyProcessed: true }
  }

  const buyerId = pi.metadata.buyer_id?.trim() || null
  if (!buyerId) {
    return { ok: false, error: "Invalid payment metadata", status: 400 }
  }

  const listingIdsOrdered = marketplaceListingIdsFromPaymentIntent(pi)
  if (listingIdsOrdered.length === 0) {
    return { ok: false, error: "Invalid payment metadata", status: 400 }
  }

  const buyerEmail: string | null = await getAuthEmailForUserId(buyerId)

  const { data: listingRows, error: listingsFetchErr } = await serviceSupabase
    .from("listings")
    .select(PEER_SURFBOARD_CHECKOUT_LISTING_SELECT)
    .in("id", listingIdsOrdered)

  if (listingsFetchErr || !listingRows?.length) {
    return { ok: false, error: "Listing not found", status: 404 }
  }

  const listingMap = new Map<string, PeerSurfboardCheckoutListingRow>(
    listingRows.map((row) => {
      const r = row as unknown as PeerSurfboardCheckoutListingRow
      return [r.id, r]
    }),
  )

  const listingsOrdered = listingIdsOrdered
    .map((id) => listingMap.get(id))
    .filter((row): row is PeerSurfboardCheckoutListingRow => row != null)

  if (listingsOrdered.length !== listingIdsOrdered.length) {
    return { ok: false, error: "Listing not found", status: 404 }
  }

  if (listingsOrdered.some((l) => l.user_id === buyerId)) {
    return { ok: false, error: "Invalid purchase", status: 400 }
  }

  const listingsForTotals = await applyAcceptedOfferToPeerCheckoutListings(
    serviceSupabase,
    buyerId,
    listingsOrdered,
  )

  const bundleSellerId = listingsForTotals[0]!.user_id
  if (!listingsForTotals.every((l) => l.user_id === bundleSellerId)) {
    return { ok: false, error: "Invalid purchase", status: 400 }
  }

  if (listingsOrdered.some((l) => l.status !== "active")) {
    return {
      ok: false,
      error: "This listing is no longer available. Contact support if you were charged.",
      status: 409,
    }
  }

  const fulfillmentMeta = pi.metadata.fulfillment
  let impliedFulfillment: "pickup" | "shipping"

  if (listingsOrdered.length > 1) {
    if (fulfillmentMeta !== "pickup") {
      return { ok: false, error: "Invalid payment metadata", status: 400 }
    }
    if (!listingsOrdered.every((l) => l.local_pickup !== false)) {
      return {
        ok: false,
        error: "Every board in this order must offer local pickup.",
        status: 400,
      }
    }
    impliedFulfillment = "pickup"
  } else {
    const listingOne = listingsOrdered[0]!
    const lp = listingOne.local_pickup !== false
    const sa = !!listingOne.shipping_available
    const fulfillmentParam =
      lp && sa
        ? fulfillmentMeta === "shipping" || fulfillmentMeta === "pickup"
          ? fulfillmentMeta
          : null
        : undefined

    if (lp && sa && !fulfillmentParam) {
      return { ok: false, error: "Invalid payment metadata", status: 400 }
    }

    impliedFulfillment =
      lp && sa
        ? fulfillmentParam === "shipping"
          ? "shipping"
          : "pickup"
        : !lp && sa
          ? "shipping"
          : "pickup"
  }

  const addressIdMeta = pi.metadata.address_id?.trim()
  let buyerAddress: ProfileAddressRow | null = null
  if (impliedFulfillment === "shipping" && addressIdMeta) {
    const { data: addrRow } = await serviceSupabase
      .from("addresses")
      .select("*")
      .eq("id", addressIdMeta)
      .eq("profile_id", buyerId)
      .maybeSingle()
    if (addrRow) {
      buyerAddress = addrRow as ProfileAddressRow
    }
  }

  /** Must match `/api/stripe/create-payment-intent` (`Math.round(totalUsd * 100)`). */
  const metaAmountCentsRaw = pi.metadata.amount_cents?.trim()
  const hasMetaAmountCents =
    typeof metaAmountCentsRaw === "string" &&
    metaAmountCentsRaw.length > 0 &&
    /^\d+$/.test(metaAmountCentsRaw)

  const bundle = await computePeerMultiCheckoutUsd({
    supabase: serviceSupabase,
    listingsOrdered: listingsForTotals,
    fulfillment: impliedFulfillment,
    buyerAddress,
    diagnosticTagPrefix: "finalize-order",
  })
  if (!bundle.ok) {
    return { ok: false, error: bundle.error, status: 400 }
  }

  const expectedCents = hasMetaAmountCents
    ? parseInt(metaAmountCentsRaw!, 10)
    : Math.round(bundle.totalUsd * 100)

  if (pi.amount !== expectedCents) {
    return { ok: false, error: "Payment amount does not match listing", status: 400 }
  }

  const chargedUsd = pi.amount / 100
  const shippingUsd = bundle.totalShippingUsd
  const platformFee = bundle.totalPlatformFee
  const sellerEarnings = bundle.totalSellerEarnings

  if (!Number.isFinite(sellerEarnings) || sellerEarnings < 0) {
    console.error("[stripe-complete-order] invalid seller_earnings", {
      chargedUsd,
      sellerEarnings,
      listingIds: listingIdsOrdered,
    })
    return {
      ok: false,
      error: "Could not compute seller earnings for this order. Refund from Stripe if needed.",
      status: 500,
    }
  }

  const fulfillmentMethod = impliedFulfillment

  let shippingAddressJson: Record<string, unknown> | null = null
  if (fulfillmentMethod === "shipping" && buyerAddress) {
    shippingAddressJson = profileAddressToOrderShippingJson(
      buyerAddress,
      buyerEmail,
    ) as Record<string, unknown>
  } else if (fulfillmentMethod === "shipping" && addressIdMeta) {
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

  const primaryListingId = listingsOrdered[0]!.id

  const orderId = randomUUID()

  const { data: purchase, error: insertError } = await serviceSupabase
    .from("orders")
    .insert({
      id: orderId,
      listing_id: primaryListingId,
      buyer_id: buyerId,
      seller_id: bundleSellerId,
      amount: chargedUsd,
      shipping_amount: shippingUsd,
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
      msg.includes("shipping_amount") ||
      msg.includes("order_items") ||
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

  const orderItemsPayload = bundle.lines.map((line, idx) => ({
    order_id: purchase.id,
    listing_id: line.listingId,
    sort_order: idx,
    item_price: line.itemPrice,
    shipping_amount: line.shippingUsd,
    platform_fee: line.platformFee,
    seller_earnings: line.sellerEarnings,
  }))

  const { error: orderItemsErr } = await serviceSupabase.from("order_items").insert(orderItemsPayload)

  if (orderItemsErr) {
    console.error("[stripe-complete-order] order_items insert:", orderItemsErr)
    const msg = orderItemsErr.message ?? ""
    const schemaStale =
      orderItemsErr.code === "PGRST204" || msg.includes("order_items") || msg.includes("schema cache")
    if (schemaStale) {
      return {
        ok: false,
        error:
          "Database is missing required order_items table. Apply pending Supabase migrations (see supabase/migrations), then reload the schema in the Supabase dashboard if needed.",
        status: 503,
      }
    }
    return { ok: false, error: "Could not create order lines", status: 500 }
  }

  let { data: sellerWallet } = await serviceSupabase
    .from("wallets")
    .select("*")
    .eq("user_id", bundleSellerId)
    .maybeSingle()

  if (!sellerWallet) {
    const { data: newWallet, error: walletInsertErr } = await serviceSupabase
      .from("wallets")
      .insert({ user_id: bundleSellerId })
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

  const wRow = sellerWallet as typeof sellerWallet & { pending_balance?: string | number | null }
  const prevAvailable = parseFloat(String(sellerWallet.balance ?? 0))
  const prevPending = parseFloat(String(wRow.pending_balance ?? 0))
  const newPending = Math.round((prevPending + sellerEarnings) * 100) / 100
  const newLifetimeEarned =
    Math.round((parseFloat(String(sellerWallet.lifetime_earned ?? 0)) + sellerEarnings) * 100) / 100

  const { error: sellerWalletUpdateErr } = await serviceSupabase
    .from("wallets")
    .update({
      pending_balance: newPending.toFixed(2),
      lifetime_earned: newLifetimeEarned.toFixed(2),
      updated_at: new Date().toISOString(),
    })
    .eq("id", sellerWallet.id)

  if (sellerWalletUpdateErr) {
    console.error("[stripe-complete-order] seller wallet pending update:", sellerWalletUpdateErr)
    return { ok: false, error: "Could not record pending seller earnings", status: 500 }
  }

  const walletTitleSummary =
    listingsOrdered.length === 1
      ? String(listingsOrdered[0]!.title ?? "")
      : `${listingsOrdered.length} boards`

  const { error: pendingTxErr } = await serviceSupabase.from("wallet_transactions").insert({
    wallet_id: sellerWallet.id,
    user_id: bundleSellerId,
    type: "sale",
    amount: sellerEarnings,
    balance_after: prevAvailable.toFixed(2),
    description: walletPendingSaleDescription(walletTitleSummary, platformFee),
    reference_id: String(purchase.id),
    reference_type: "order_pending_earnings",
  })

  if (pendingTxErr) {
    if (isUniqueViolation(pendingTxErr)) {
      const { data: racedLedger } = await serviceSupabase
        .from("wallet_transactions")
        .select("id")
        .eq("reference_type", "order_pending_earnings")
        .eq("reference_id", String(purchase.id))
        .maybeSingle()
      if (racedLedger?.id) {
        // Concurrent request won the insert; continue.
      } else {
        console.error("[stripe-complete-order] pending wallet_transactions duplicate without row:", pendingTxErr)
        return { ok: false, error: "Could not record pending sale", status: 500 }
      }
    } else {
      console.error("[stripe-complete-order] pending wallet_transactions:", pendingTxErr)
      return { ok: false, error: "Could not record pending sale", status: 500 }
    }
  }

  // Mark sold only — never mutate listings.price (offer discounts stay private; public sold surfaces use list price).
  const { error: listingErr } = await serviceSupabase
    .from("listings")
    .update({ status: "sold" })
    .in(
      "id",
      listingsOrdered.map((l) => l.id),
    )

  if (listingErr) {
    console.error("[stripe-complete-order] listing update:", listingErr)
    return { ok: false, error: "Could not mark listing sold", status: 500 }
  }

  revalidateBoardsBrowseCatalog()
  await revalidateSellersAfterListingChange(serviceSupabase, bundleSellerId)
  revalidateMarketplaceSoldFeedCatalog()

  void completeAcceptedOfferOnPurchase(
    serviceSupabase,
    buyerId,
    listingIdsOrdered,
    bundleSellerId,
  )

  for (const listingId of listingIdsOrdered) {
    void syncListingToGoogleMerchantBestEffort(serviceSupabase, listingId)
  }

  for (const line of bundle.lines) {
    void markUserListingBoardModelDataSold(serviceSupabase, line.listingId, line.itemPrice)
  }

  void deleteBuyerCartRowsForListings(serviceSupabase, buyerId, listingIdsOrdered)

  const listingTitles = listingsOrdered.map((l) => String(l.title ?? ""))

  if (buyerId) {
    void postPurchaseThreadNotification(serviceSupabase, {
      buyerId,
      sellerId: bundleSellerId,
      primaryListingId,
      listingIds: listingIdsOrdered,
      listingTitles,
      listingTitleSummary:
        listingTitles.length === 1
          ? listingTitles[0]!
          : `${listingTitles.length} items — ${listingTitles.map((t) => `"${t}"`).join(", ")}`,
      orderId: purchase.id,
      orderNum: formatOrderNumForCustomer(
        (purchase as { order_num?: string | null }).order_num,
        purchase.id,
      ),
      total: chargedUsd,
      fulfillment: isPickup ? "pickup" : "shipping",
      shippingAddress: shippingAddressJson,
      paymentMethod: "card",
    })
  }

  const klListingTitle =
    listingsOrdered.length === 1
      ? String(listingsOrdered[0]!.title ?? "")
      : `${listingsOrdered.length} boards (${listingTitles.slice(0, 3).join(" · ")}${listingTitles.length > 3 ? "…" : ""})`

  const klaviyoLineItems: KlaviyoBuyerOrderLineItem[] = listingsForTotals.map((listing, idx) => ({
    listingId: listing.id,
    listingTitle: String(listing.title ?? ""),
    listingSection: String(listing.section ?? "surfboards"),
    price: bundle.lines[idx]?.itemPrice ?? parseFloat(String(listing.price)),
    quantity: 1,
  }))

  await trackKlaviyoBuyerOrderConfirmed({
    buyerUserId: buyerId ?? undefined,
    buyerEmail,
    orderId: purchase.id,
    orderNum: (purchase as { order_num?: string | null }).order_num ?? null,
    listingId: primaryListingId,
    listingTitle: klListingTitle.slice(0, 500),
    listingSection: String(listingsOrdered[0]!.section ?? ""),
    listingSlug: null,
    lineItems: klaviyoLineItems,
    amount: chargedUsd,
    fulfillmentMethod: isPickup ? "pickup" : "shipping",
    pickupCode,
    paymentMethod: "stripe",
  })

  void trackMetaPurchaseServerEvent({
    orderId: purchase.id,
    buyerUserId: buyerId,
    buyerEmail,
    value: chargedUsd,
    contentIds: listingIdsOrdered,
  })

  if (!isPickup && fulfillmentMethod === "shipping") {
    await purchaseReswellShippingLabelAfterCheckout(serviceSupabase, purchase.id)
  }

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
