import type { SupabaseClient } from "@supabase/supabase-js"
import type Stripe from "stripe"
import { fetchOrderIdsWithPreparedShippingLabels } from "@/lib/db/orderShippingLabels"
import {
  deductWalletForInternalSpendAtomic,
  refundWalletInternalSpend,
} from "@/lib/db/wallets"
import type { ProfileAddressRow } from "@/lib/profile-address"
import { isPeerListingSection } from "@/lib/peer-listing-sections"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import { REAL_MARKETPLACE_SALES_FILTER } from "@/lib/order-admin-test"
import { getSellerBalance } from "@/lib/getSellerBalance"
import { autoDispatchOrderIfTrackingReady } from "@/lib/services/markOrderShipped"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  purchaseLabelWithRateId,
  resolveAddressesForLabel,
} from "@/lib/services/orderShippingLabel"
import { effectiveBoardShippingMode } from "@/lib/services/peerListingShippingQuote"
import { retrieveSucceededPaymentIntent } from "@/lib/stripe-complete-order"
import { getStripe, getStripeCheckoutKeyConfigError } from "@/lib/stripe-server"
import { isShipEngineConfigured } from "@/lib/shipengine/config"
import { getShipEngineRateById } from "@/lib/shipengine/surfboard-label"
import type { ShipEngineRateOption } from "@/lib/shipengine/surfboard-label"
import { roundMoney } from "@/lib/utils/stripe-connect-cashout"

export const SELLER_SHIPPING_LABEL_PI_PURPOSE = "seller_shipping_label"
export const SELLER_SHIPPING_LABEL_WALLET_REFERENCE_TYPE = "seller_shipping_label"

function getClientForPrivilegedWalletWrites(sessionClient: SupabaseClient): SupabaseClient {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return sessionClient
  }
  try {
    return createServiceRoleClient()
  } catch (e) {
    console.error("[sellerShippingLabelCheckout] createServiceRoleClient failed; using session client", e)
    return sessionClient
  }
}

type PurchasedLabelPayload = {
  labelUrl: string | null
  trackingNumber: string
  trackingCarrier: string
}

async function findWalletLabelPurchaseByOrder(
  supabase: SupabaseClient,
  orderId: string,
): Promise<{ walletTransactionId: string } | null> {
  const { data } = await supabase
    .from("wallet_transactions")
    .select("id")
    .eq("reference_type", SELLER_SHIPPING_LABEL_WALLET_REFERENCE_TYPE)
    .eq("reference_id", orderId)
    .maybeSingle()

  const id = (data as { id?: string } | null)?.id
  return id ? { walletTransactionId: id } : null
}

export type SellerLabelPurchasableOrder = {
  orderId: string
  displayOrderNum: string
  listingTitle: string
  section: string
  shippingMode: "free" | "flat"
  createdAt: string
}

/**
 * Pending shipping sales where the seller can buy a label through Reswell
 * (flat/free shipping on a peer listing, no label on file yet). Powers the
 * label entry point on /shipping for logged-in sellers.
 */
export async function listSellerLabelPurchasableOrders(
  supabase: SupabaseClient,
  sellerId: string,
): Promise<SellerLabelPurchasableOrder[]> {
  if (!isShipEngineConfigured()) return []

  const { data, error } = await supabase
    .from("orders")
    .select(
      `
      id,
      order_num,
      status,
      created_at,
      listings ( section, title, board_shipping_cost_mode, shipping_price )
    `,
    )
    .eq("seller_id", sellerId)
    .eq("fulfillment_method", "shipping")
    .eq("delivery_status", "pending")
    .in("status", ["pending", "confirmed"])
    .match(REAL_MARKETPLACE_SALES_FILTER)
    .order("created_at", { ascending: false })
    .limit(20)

  if (error || !data?.length) return []

  type Row = {
    id: string
    order_num: string | null
    status: string
    created_at: string
    listings:
      | {
          section: string
          title: string | null
          board_shipping_cost_mode?: string | null
          shipping_price?: string | number | null
        }
      | {
          section: string
          title: string | null
          board_shipping_cost_mode?: string | null
          shipping_price?: string | number | null
        }[]
      | null
  }

  const candidates: SellerLabelPurchasableOrder[] = []
  for (const row of data as Row[]) {
    const listing = Array.isArray(row.listings) ? row.listings[0] : row.listings
    if (!listing || !isPeerListingSection(listing.section)) continue
    const mode = effectiveBoardShippingMode(listing)
    if (mode === "reswell") continue
    candidates.push({
      orderId: row.id,
      displayOrderNum: formatOrderNumForCustomer(row.order_num, row.id),
      listingTitle: listing.title?.trim() || "Item",
      section: listing.section,
      shippingMode: mode,
      createdAt: row.created_at,
    })
  }
  if (candidates.length === 0) return []

  const prepared = await fetchOrderIdsWithPreparedShippingLabels(
    supabase,
    candidates.map((c) => c.orderId),
  )
  return candidates.filter((c) => !prepared.has(c.orderId))
}

type SellerLabelOrderRow = {
  id: string
  order_num: string | null
  seller_id: string
  listing_id: string
  fulfillment_method: string | null
  delivery_status: string
  shipping_address: unknown
  listings:
    | {
        section: string
        board_shipping_cost_mode?: string | null
        shipping_price?: string | number | null
      }
    | {
        section: string
        board_shipping_cost_mode?: string | null
        shipping_price?: string | number | null
      }[]
    | null
}

export type SellerShippingLabelOrderContext =
  | {
      ok: true
      order: SellerLabelOrderRow
      section: string
      shippingMode: "free" | "flat" | "reswell"
    }
  | { ok: false; error: string; status: number }

export async function loadSellerShippingLabelOrderContext(
  supabase: SupabaseClient,
  orderId: string,
  sellerId: string,
): Promise<SellerShippingLabelOrderContext> {
  if (!isShipEngineConfigured()) {
    return {
      ok: false,
      error: "Label purchasing is not available right now. Contact support.",
      status: 503,
    }
  }

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select(
      `
      id,
      order_num,
      seller_id,
      listing_id,
      fulfillment_method,
      delivery_status,
      shipping_address,
      listings ( section, board_shipping_cost_mode, shipping_price )
    `,
    )
    .eq("id", orderId)
    .eq("seller_id", sellerId)
    .maybeSingle()

  if (orderErr || !order) {
    return { ok: false, error: "Order not found", status: 404 }
  }

  const o = order as SellerLabelOrderRow

  const listing = Array.isArray(o.listings) ? o.listings[0] : o.listings
  const section = listing?.section ?? ""
  if (!listing || !isPeerListingSection(section)) {
    return {
      ok: false,
      error: "Shipping labels are only for marketplace peer listings.",
      status: 400,
    }
  }

  if (o.fulfillment_method !== "shipping") {
    return { ok: false, error: "This order is not a shipping order.", status: 400 }
  }

  if (o.delivery_status !== "pending") {
    return { ok: false, error: "This order already has tracking.", status: 409 }
  }

  const shippingMode = effectiveBoardShippingMode(listing)
  if (shippingMode === "reswell") {
    return {
      ok: false,
      error:
        "Reswell purchases the shipping label automatically for this order. Check your sale page for the label.",
      status: 400,
    }
  }

  const prepared = await fetchOrderIdsWithPreparedShippingLabels(supabase, [orderId])
  if (prepared.has(orderId)) {
    return { ok: false, error: "A shipping label is already on file for this order.", status: 409 }
  }

  return {
    ok: true,
    order: o,
    section,
    shippingMode,
  }
}

async function resolveSellerAddress(
  supabase: SupabaseClient,
  sellerId: string,
  sellerAddressId: string | null,
): Promise<{ ok: true; address: ProfileAddressRow } | { ok: false; error: string; status: number }> {
  let addressId = sellerAddressId?.trim() || null
  if (!addressId) {
    const { data: addrRows } = await supabase
      .from("addresses")
      .select("*")
      .eq("profile_id", sellerId)
      .order("is_default", { ascending: false })
    const rows = (addrRows ?? []) as ProfileAddressRow[]
    const preferred = rows.find((r) => r.is_default) ?? rows[0]
    if (!preferred) {
      return {
        ok: false,
        error: "Save a ship-from address on your profile first.",
        status: 400,
      }
    }
    addressId = preferred.id
  }

  const { data: addr, error: addrErr } = await supabase
    .from("addresses")
    .select("*")
    .eq("id", addressId)
    .eq("profile_id", sellerId)
    .maybeSingle()

  if (addrErr || !addr) {
    return { ok: false, error: "Seller address not found", status: 400 }
  }

  return { ok: true, address: addr as ProfileAddressRow }
}

export async function resolveSellerShippingLabelRate(params: {
  supabase: SupabaseClient
  order: SellerLabelOrderRow
  sellerId: string
  rateId: string
  sellerAddressId?: string | null
  parcel?: { length_in: number; width_in: number; height_in: number; weight_lb: number }
}): Promise<
  | { ok: true; rate: ShipEngineRateOption; sellerAddressId: string }
  | { ok: false; error: string; status: number }
> {
  const sellerAddr = await resolveSellerAddress(
    params.supabase,
    params.sellerId,
    params.sellerAddressId ?? null,
  )
  if (!sellerAddr.ok) return sellerAddr

  const resolved = resolveAddressesForLabel({
    sellerAddress: sellerAddr.address,
    orderShippingJson: params.order.shipping_address,
  })
  if (!resolved.ok) {
    return { ok: false, error: resolved.error, status: 400 }
  }

  // ShipEngine mints new rate ids on every quote request, so the selected rate
  // must be looked up directly by id — re-quoting would never re-find it.
  const rateResult = await getShipEngineRateById(params.rateId)
  if (!rateResult.ok) return rateResult

  const rate = rateResult.rate
  if (rate.currency.toUpperCase() !== "USD") {
    return { ok: false, error: "Only USD carrier rates are supported.", status: 400 }
  }

  return { ok: true, rate, sellerAddressId: sellerAddr.address.id }
}

export async function createSellerShippingLabelPaymentIntent(params: {
  supabase: SupabaseClient
  orderId: string
  sellerId: string
  rateId: string
  sellerAddressId?: string | null
  parcel?: { length_in: number; width_in: number; height_in: number; weight_lb: number }
}): Promise<
  | { ok: true; clientSecret: string; amountUsd: number }
  | { ok: false; error: string; status: number }
> {
  const keyConfigError = getStripeCheckoutKeyConfigError()
  if (keyConfigError) {
    return { ok: false, error: keyConfigError, status: 503 }
  }

  const ctx = await loadSellerShippingLabelOrderContext(
    params.supabase,
    params.orderId,
    params.sellerId,
  )
  if (!ctx.ok) return ctx

  const rateResolved = await resolveSellerShippingLabelRate({
    supabase: params.supabase,
    order: ctx.order,
    sellerId: params.sellerId,
    rateId: params.rateId,
    sellerAddressId: params.sellerAddressId,
    parcel: params.parcel,
  })
  if (!rateResolved.ok) return rateResolved

  const amountCents = Math.round(rateResolved.rate.amount * 100)
  if (amountCents < 50) {
    return { ok: false, error: "Label cost is below the minimum charge.", status: 400 }
  }

  try {
    const stripe = getStripe()
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      metadata: {
        purpose: SELLER_SHIPPING_LABEL_PI_PURPOSE,
        order_id: params.orderId,
        seller_id: params.sellerId,
        rate_id: rateResolved.rate.rate_id,
        amount_cents: String(amountCents),
        carrier_label: rateResolved.rate.carrierLabel.slice(0, 200),
        service_name: rateResolved.rate.serviceName.slice(0, 200),
      },
      description: `Reswell shipping label — order ${formatOrderNumForCustomer(ctx.order.order_num, ctx.order.id)}`.slice(
        0,
        1000,
      ),
    })

    if (!paymentIntent.client_secret) {
      return { ok: false, error: "Could not start payment", status: 500 }
    }

    return {
      ok: true,
      clientSecret: paymentIntent.client_secret,
      amountUsd: amountCents / 100,
    }
  } catch (e) {
    console.error("[createSellerShippingLabelPaymentIntent] Stripe:", e)
    return { ok: false, error: "Could not create payment", status: 502 }
  }
}

async function findLabelPurchaseByPaymentIntent(
  supabase: SupabaseClient,
  paymentIntentId: string,
): Promise<{ orderId: string } | null> {
  const { data } = await supabase
    .from("order_shipping_labels")
    .select("order_id")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle()

  const orderId = (data as { order_id?: string } | null)?.order_id
  return orderId ? { orderId } : null
}

async function getServiceSupabaseOrError(): Promise<
  { ok: true; client: SupabaseClient } | { ok: false; error: string; status: number }
> {
  try {
    return { ok: true, client: createServiceRoleClient() }
  } catch (e) {
    console.error("[sellerShippingLabelCheckout] service role client:", e)
    return { ok: false, error: "Label purchasing is not configured on the server.", status: 503 }
  }
}

async function persistSellerPaidLabelAndTracking(params: {
  serviceSupabase: SupabaseClient
  orderId: string
  sellerId: string
  orderNum: string | null
  rateId: string
  purchased: PurchasedLabelPayload
  stripePaymentIntentId?: string | null
}): Promise<
  | {
      ok: true
      alreadyProcessed: boolean
      labelUrl: string | null
      trackingNumber: string
      orderDisplayNum: string
    }
  | { ok: false; error: string; status: number }
> {
  const { error: labelInsertErr } = await params.serviceSupabase.from("order_shipping_labels").insert({
    order_id: params.orderId,
    origin: "seller_paid",
    label_pdf_url: params.purchased.labelUrl,
    label_storage_path: null,
    tracking_number: params.purchased.trackingNumber,
    tracking_carrier: params.purchased.trackingCarrier,
    shipengine_rate_id: params.rateId,
    stripe_payment_intent_id: params.stripePaymentIntentId ?? null,
  })

  if (labelInsertErr) {
    const isDuplicate =
      labelInsertErr.code === "23505" ||
      labelInsertErr.message?.includes("order_shipping_labels_stripe_pi_uidx")
    if (isDuplicate && params.stripePaymentIntentId) {
      const raced = await findLabelPurchaseByPaymentIntent(
        params.serviceSupabase,
        params.stripePaymentIntentId,
      )
      if (raced) {
        return {
          ok: true,
          alreadyProcessed: true,
          labelUrl: params.purchased.labelUrl,
          trackingNumber: params.purchased.trackingNumber,
          orderDisplayNum: formatOrderNumForCustomer(params.orderNum, params.orderId),
        }
      }
    }
    console.error("[sellerShippingLabelCheckout] label insert:", labelInsertErr)
    return { ok: false, error: "Label purchased but could not be saved. Contact support.", status: 500 }
  }

  const { data: trackedOrder, error: trackErr } = await params.serviceSupabase
    .from("orders")
    .update({
      tracking_number: params.purchased.trackingNumber,
      tracking_carrier: params.purchased.trackingCarrier,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.orderId)
    .eq("seller_id", params.sellerId)
    .eq("delivery_status", "pending")
    .select("id")
    .maybeSingle()

  if (trackErr || !trackedOrder) {
    console.error(
      "[sellerShippingLabelCheckout] save tracking:",
      trackErr?.message ?? "order not pending or not found",
    )
    return {
      ok: false,
      error:
        "Label purchased and paid for, but tracking could not be saved. Contact support with your payment confirmation.",
      status: 500,
    }
  }

  await autoDispatchOrderIfTrackingReady(params.serviceSupabase, params.orderId, params.sellerId)

  return {
    ok: true,
    alreadyProcessed: false,
    labelUrl: params.purchased.labelUrl,
    trackingNumber: params.purchased.trackingNumber,
    orderDisplayNum: formatOrderNumForCustomer(params.orderNum, params.orderId),
  }
}

async function findExistingSellerPaidLabelForOrder(
  serviceSupabase: SupabaseClient,
  orderId: string,
): Promise<
  | {
      ok: true
      labelUrl: string | null
      trackingNumber: string
      orderDisplayNum: string
    }
  | { ok: false }
> {
  const prepared = await fetchOrderIdsWithPreparedShippingLabels(serviceSupabase, [orderId])
  if (!prepared.has(orderId)) return { ok: false }

  const { data: orderRow } = await serviceSupabase
    .from("orders")
    .select("order_num, tracking_number")
    .eq("id", orderId)
    .maybeSingle()
  const o = orderRow as { order_num: string | null; tracking_number: string | null } | null

  const { data: labelRow } = await serviceSupabase
    .from("order_shipping_labels")
    .select("label_pdf_url")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  return {
    ok: true,
    labelUrl: (labelRow as { label_pdf_url?: string | null } | null)?.label_pdf_url ?? null,
    trackingNumber: o?.tracking_number?.trim() || "",
    orderDisplayNum: formatOrderNumForCustomer(o?.order_num ?? null, orderId),
  }
}

function validateSellerLabelPaymentIntentMetadata(
  pi: Stripe.PaymentIntent,
  expected?: { orderId?: string; sellerId?: string },
): { ok: true; orderId: string; sellerId: string; rateId: string } | { ok: false; error: string } {
  if (pi.metadata?.purpose !== SELLER_SHIPPING_LABEL_PI_PURPOSE) {
    return { ok: false, error: "Invalid payment type" }
  }

  const orderId = pi.metadata.order_id?.trim() || ""
  const sellerId = pi.metadata.seller_id?.trim() || ""
  const rateId = pi.metadata.rate_id?.trim() || ""
  const amountCentsRaw = pi.metadata.amount_cents?.trim() || ""

  if (!orderId || !sellerId || !rateId || !amountCentsRaw) {
    return { ok: false, error: "Payment is missing label metadata" }
  }

  const amountCents = parseInt(amountCentsRaw, 10)
  if (!Number.isFinite(amountCents) || amountCents < 50 || pi.amount !== amountCents) {
    return { ok: false, error: "Payment amount does not match the selected label rate" }
  }

  if (expected?.orderId && expected.orderId !== orderId) {
    return { ok: false, error: "Payment does not match this order" }
  }
  if (expected?.sellerId && expected.sellerId !== sellerId) {
    return { ok: false, error: "Unauthorized" }
  }

  return { ok: true, orderId, sellerId, rateId }
}

export async function completeSellerShippingLabelFromPaymentIntent(params: {
  supabase: SupabaseClient
  paymentIntent: Stripe.PaymentIntent
  expectedSellerId?: string
  expectedOrderId?: string
}): Promise<
  | {
      ok: true
      orderId: string
      alreadyProcessed: boolean
      labelUrl: string | null
      trackingNumber: string
      orderDisplayNum: string
    }
  | { ok: false; error: string; status: number }
> {
  const meta = validateSellerLabelPaymentIntentMetadata(params.paymentIntent, {
    orderId: params.expectedOrderId,
    sellerId: params.expectedSellerId,
  })
  if (!meta.ok) {
    return { ok: false, error: meta.error, status: 400 }
  }

  // order_shipping_labels has RLS with no user policies — label reads/writes and
  // the tracking update must run with the service role, regardless of the caller.
  const serviceClient = await getServiceSupabaseOrError()
  if (!serviceClient.ok) return serviceClient
  const serviceSupabase = serviceClient.client

  const existing = await findLabelPurchaseByPaymentIntent(serviceSupabase, params.paymentIntent.id)
  if (existing) {
    const { data: orderRow } = await serviceSupabase
      .from("orders")
      .select("order_num, tracking_number")
      .eq("id", existing.orderId)
      .maybeSingle()
    const o = orderRow as { order_num: string | null; tracking_number: string | null } | null
    return {
      ok: true,
      orderId: existing.orderId,
      alreadyProcessed: true,
      labelUrl: null,
      trackingNumber: o?.tracking_number?.trim() || "",
      orderDisplayNum: formatOrderNumForCustomer(o?.order_num ?? null, existing.orderId),
    }
  }

  const ctx = await loadSellerShippingLabelOrderContext(
    params.supabase,
    meta.orderId,
    meta.sellerId,
  )
  if (!ctx.ok) return ctx

  const purchased = await purchaseLabelWithRateId(meta.rateId)
  if (!purchased.ok) {
    return { ok: false, error: purchased.error, status: purchased.status }
  }

  const saved = await persistSellerPaidLabelAndTracking({
    serviceSupabase,
    orderId: meta.orderId,
    sellerId: meta.sellerId,
    orderNum: ctx.order.order_num,
    rateId: meta.rateId,
    purchased: purchased.result,
    stripePaymentIntentId: params.paymentIntent.id,
  })
  if (!saved.ok) return saved

  return {
    ok: true,
    orderId: meta.orderId,
    alreadyProcessed: saved.alreadyProcessed,
    labelUrl: saved.labelUrl,
    trackingNumber: saved.trackingNumber,
    orderDisplayNum: saved.orderDisplayNum,
  }
}

export async function finalizeSellerShippingLabelPurchase(params: {
  supabase: SupabaseClient
  orderId: string
  sellerId: string
  paymentIntentId: string
}): Promise<
  | {
      ok: true
      labelUrl: string | null
      trackingNumber: string
      orderDisplayNum: string
      alreadyProcessed: boolean
    }
  | { ok: false; error: string; status: number }
> {
  const retrieved = await retrieveSucceededPaymentIntent(params.paymentIntentId)
  if (!retrieved.ok) return retrieved

  const completed = await completeSellerShippingLabelFromPaymentIntent({
    supabase: params.supabase,
    paymentIntent: retrieved.paymentIntent,
    expectedSellerId: params.sellerId,
    expectedOrderId: params.orderId,
  })

  if (!completed.ok) return completed

  return {
    ok: true,
    labelUrl: completed.labelUrl,
    trackingNumber: completed.trackingNumber,
    orderDisplayNum: completed.orderDisplayNum,
    alreadyProcessed: completed.alreadyProcessed,
  }
}

export function isSellerShippingLabelPaymentIntent(pi: Stripe.PaymentIntent): boolean {
  return pi.metadata?.purpose === SELLER_SHIPPING_LABEL_PI_PURPOSE
}

export async function purchaseSellerShippingLabelWithWallet(params: {
  supabase: SupabaseClient
  orderId: string
  sellerId: string
  rateId: string
  sellerAddressId?: string | null
  parcel?: { length_in: number; width_in: number; height_in: number; weight_lb: number }
}): Promise<
  | {
      ok: true
      labelUrl: string | null
      trackingNumber: string
      orderDisplayNum: string
      alreadyProcessed: boolean
      amountUsd: number
      walletBalanceAfter: number
    }
  | { ok: false; error: string; status: number }
> {
  const ctx = await loadSellerShippingLabelOrderContext(
    params.supabase,
    params.orderId,
    params.sellerId,
  )
  if (!ctx.ok) return ctx

  const rateResolved = await resolveSellerShippingLabelRate({
    supabase: params.supabase,
    order: ctx.order,
    sellerId: params.sellerId,
    rateId: params.rateId,
    sellerAddressId: params.sellerAddressId,
    parcel: params.parcel,
  })
  if (!rateResolved.ok) return rateResolved

  const amountUsd = roundMoney(rateResolved.rate.amount)
  if (amountUsd < 0.5) {
    return { ok: false, error: "Label cost is below the minimum charge.", status: 400 }
  }

  const serviceClient = await getServiceSupabaseOrError()
  if (!serviceClient.ok) return serviceClient
  const serviceSupabase = serviceClient.client

  const existingLabel = await findExistingSellerPaidLabelForOrder(serviceSupabase, params.orderId)
  if (existingLabel.ok) {
    const walletSummary = await getSellerBalance(params.supabase, params.sellerId)
    return {
      ok: true,
      labelUrl: existingLabel.labelUrl,
      trackingNumber: existingLabel.trackingNumber,
      orderDisplayNum: existingLabel.orderDisplayNum,
      alreadyProcessed: true,
      amountUsd,
      walletBalanceAfter: walletSummary.spendableBucks,
    }
  }

  const existingWalletTx = await findWalletLabelPurchaseByOrder(serviceSupabase, params.orderId)
  if (existingWalletTx) {
    return {
      ok: false,
      error:
        "Wallet payment was recorded but the label is missing. Contact support with your order number.",
      status: 500,
    }
  }

  const walletSummary = await getSellerBalance(params.supabase, params.sellerId)
  if (walletSummary.spendableBucks < amountUsd) {
    return {
      ok: false,
      error: `Insufficient wallet balance. Available: $${walletSummary.spendableBucks.toFixed(2)}`,
      status: 400,
    }
  }

  const writeDb = getClientForPrivilegedWalletWrites(params.supabase)
  let deducted: Awaited<ReturnType<typeof deductWalletForInternalSpendAtomic>>
  try {
    deducted = await deductWalletForInternalSpendAtomic(writeDb, params.sellerId, amountUsd)
  } catch (e) {
    console.error("[purchaseSellerShippingLabelWithWallet] deduct rpc:", e)
    return { ok: false, error: "Could not debit wallet balance", status: 500 }
  }

  if (!deducted) {
    return {
      ok: false,
      error: `Insufficient wallet balance. Available: $${walletSummary.spendableBucks.toFixed(2)}`,
      status: 400,
    }
  }

  const orderDisplayNum = formatOrderNumForCustomer(ctx.order.order_num, ctx.order.id)
  const carrierLabel = rateResolved.rate.carrierLabel.slice(0, 80)
  const serviceName = rateResolved.rate.serviceName.slice(0, 80)

  const { error: walletTxErr } = await writeDb.from("wallet_transactions").insert({
    wallet_id: deducted.walletId,
    user_id: params.sellerId,
    type: "purchase",
    amount: -amountUsd,
    balance_after: deducted.balanceAfter.toFixed(2),
    description: `Shipping label — order #${orderDisplayNum} (${carrierLabel} ${serviceName})`,
    reference_id: params.orderId,
    reference_type: SELLER_SHIPPING_LABEL_WALLET_REFERENCE_TYPE,
  })

  if (walletTxErr) {
    console.error("[purchaseSellerShippingLabelWithWallet] wallet tx insert:", walletTxErr)
    try {
      await refundWalletInternalSpend(writeDb, params.sellerId, amountUsd)
    } catch (refundErr) {
      console.error("[purchaseSellerShippingLabelWithWallet] CRITICAL refund after tx insert fail", refundErr)
    }
    const isDuplicate =
      walletTxErr.code === "23505" || walletTxErr.message?.includes("wallet_tx_seller_shipping_label_uidx")
    if (isDuplicate) {
      const racedLabel = await findExistingSellerPaidLabelForOrder(serviceSupabase, params.orderId)
      if (racedLabel.ok) {
        return {
          ok: true,
          labelUrl: racedLabel.labelUrl,
          trackingNumber: racedLabel.trackingNumber,
          orderDisplayNum: racedLabel.orderDisplayNum,
          alreadyProcessed: true,
          amountUsd,
          walletBalanceAfter: deducted.balanceAfter,
        }
      }
      return {
        ok: false,
        error:
          "Wallet payment was recorded but the label is missing. Contact support with your order number.",
        status: 500,
      }
    }
    return { ok: false, error: "Could not record wallet payment", status: 500 }
  }

  const purchased = await purchaseLabelWithRateId(rateResolved.rate.rate_id)
  if (!purchased.ok) {
    try {
      await refundWalletInternalSpend(writeDb, params.sellerId, amountUsd)
      await writeDb
        .from("wallet_transactions")
        .delete()
        .eq("reference_type", SELLER_SHIPPING_LABEL_WALLET_REFERENCE_TYPE)
        .eq("reference_id", params.orderId)
    } catch (refundErr) {
      console.error(
        "[purchaseSellerShippingLabelWithWallet] CRITICAL refund after label purchase fail",
        refundErr,
      )
    }
    return { ok: false, error: purchased.error, status: purchased.status }
  }

  const saved = await persistSellerPaidLabelAndTracking({
    serviceSupabase,
    orderId: params.orderId,
    sellerId: params.sellerId,
    orderNum: ctx.order.order_num,
    rateId: rateResolved.rate.rate_id,
    purchased: purchased.result,
  })

  if (!saved.ok) {
    return saved
  }

  return {
    ok: true,
    labelUrl: saved.labelUrl,
    trackingNumber: saved.trackingNumber,
    orderDisplayNum: saved.orderDisplayNum,
    alreadyProcessed: saved.alreadyProcessed,
    amountUsd,
    walletBalanceAfter: deducted.balanceAfter,
  }
}
