import type { SupabaseClient } from "@supabase/supabase-js"
import type Stripe from "stripe"
import { fetchOrderIdsWithPreparedShippingLabels } from "@/lib/db/orderShippingLabels"
import {
  deductWalletForInternalSpendAtomic,
  getOrCreateWalletForUser,
  refundWalletInternalSpend,
} from "@/lib/db/wallets"
import type { ProfileAddressRow } from "@/lib/profile-address"
import { isPeerListingSection } from "@/lib/peer-listing-sections"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import { REAL_MARKETPLACE_SALES_FILTER } from "@/lib/order-admin-test"
import { getSellerBalance } from "@/lib/getSellerBalance"
import { autoDispatchOrderIfTrackingReady } from "@/lib/services/markOrderShipped"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { resolveAddressesForLabel } from "@/lib/services/orderShippingLabel"
import { purchaseShipEngineLabelForOrderOnce } from "@/lib/services/purchaseShipEngineLabelForOrderOnce"
import {
  effectiveBoardShippingMode,
  type PeerListingForShippingQuote,
} from "@/lib/services/peerListingShippingQuote"
import { retrieveSucceededPaymentIntent } from "@/lib/stripe-complete-order"
import { getStripe, getStripeCheckoutKeyConfigError } from "@/lib/stripe-server"
import { isShipEngineConfigured } from "@/lib/shipengine/config"
import { getShipEngineRateById } from "@/lib/shipengine/surfboard-label"
import type { ShipEngineRateOption } from "@/lib/shipengine/surfboard-label"
import { creditOrderPendingEarnings } from "@/lib/services/orderPendingEarnings"
import { roundMoney } from "@/lib/utils/stripe-connect-cashout"
import {
  computeSellerLabelCardPaymentBreakdown,
  computeSellerLabelPaymentBreakdown,
  computeSellerLabelPrepaidAllowanceBreakdown,
  type SellerLabelPaymentBreakdown,
} from "@/lib/shipping/seller-label-payment-breakdown"

export const SELLER_SHIPPING_LABEL_PI_PURPOSE = "seller_shipping_label"
export const SELLER_SHIPPING_LABEL_WALLET_REFERENCE_TYPE = "seller_shipping_label"
export const SELLER_FLAT_SHIPPING_SURPLUS_REFERENCE_TYPE = "seller_flat_shipping_surplus"

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
  paperlessQrUrl?: string | null
  paperlessInstructions?: string | null
  paperlessHandoffCode?: string | null
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

async function findFlatShippingSurplusCreditByOrder(
  supabase: SupabaseClient,
  orderId: string,
): Promise<{ walletTransactionId: string } | null> {
  const { data } = await supabase
    .from("wallet_transactions")
    .select("id")
    .eq("reference_type", SELLER_FLAT_SHIPPING_SURPLUS_REFERENCE_TYPE)
    .eq("reference_id", orderId)
    .maybeSingle()

  const id = (data as { id?: string } | null)?.id
  return id ? { walletTransactionId: id } : null
}

async function creditSellerFlatShippingSurplus(params: {
  writeDb: SupabaseClient
  sellerId: string
  orderId: string
  orderDisplayNum: string
  surplusUsd: number
}): Promise<{ ok: true; balanceAfter: number } | { ok: false; error: string }> {
  const summary = await getSellerBalance(params.writeDb, params.sellerId)

  if (params.surplusUsd <= 0) {
    return { ok: true, balanceAfter: summary.spendableBucks }
  }

  const existing = await findFlatShippingSurplusCreditByOrder(params.writeDb, params.orderId)
  if (existing) {
    return { ok: true, balanceAfter: summary.spendableBucks }
  }

  const creditUsd = roundMoney(params.surplusUsd)
  const credited = await creditOrderPendingEarnings(params.writeDb, {
    userId: params.sellerId,
    amountUsd: creditUsd,
    orderId: params.orderId,
    description: `Pending — Flat shipping surplus — order #${params.orderDisplayNum} ($${creditUsd.toFixed(2)} unused buyer shipping — available after delivery)`,
    referenceType: SELLER_FLAT_SHIPPING_SURPLUS_REFERENCE_TYPE,
  })

  if (!credited.ok) {
    console.error("[creditSellerFlatShippingSurplus] pending credit:", credited.error)
    return { ok: false, error: "Could not credit shipping surplus to seller wallet" }
  }

  return { ok: true, balanceAfter: summary.spendableBucks }
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

function parseOrderShippingAmountUsd(v: string | number | null | undefined): number {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? roundMoney(n) : 0
}

type BuyerPrepaidListingSource = {
  board_shipping_cost_mode?: string | null
  shipping_price?: string | number | null
}

/** Buyer shipping credit for label purchase: order `shipping_amount`, or flat listing rate when missing. */
export function resolveBuyerPrepaidShippingUsdForOrder(input: {
  shippingAmount?: string | number | null
  listing: BuyerPrepaidListingSource
}): number {
  const fromOrder = parseOrderShippingAmountUsd(input.shippingAmount)
  if (fromOrder > 0) return fromOrder

  const mode = effectiveBoardShippingMode(input.listing as PeerListingForShippingQuote)
  if (mode === "flat") {
    return roundMoney(Math.max(0, parseFloat(String(input.listing.shipping_price ?? 0)) || 0))
  }
  return 0
}

function buyerPrepaidFromOrderContext(order: SellerLabelOrderRow): number {
  const listing = Array.isArray(order.listings) ? order.listings[0] : order.listings
  if (!listing) return parseOrderShippingAmountUsd(order.shipping_amount)
  return resolveBuyerPrepaidShippingUsdForOrder({
    shippingAmount: order.shipping_amount,
    listing,
  })
}

export type { SellerLabelPaymentBreakdown } from "@/lib/shipping/seller-label-payment-breakdown"
export { computeSellerLabelPaymentBreakdown } from "@/lib/shipping/seller-label-payment-breakdown"

type SellerLabelOrderRow = {
  id: string
  order_num: string | null
  seller_id: string
  listing_id: string
  fulfillment_method: string | null
  delivery_status: string
  shipping_address: unknown
  shipping_amount?: string | number | null
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
      shipping_amount,
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
  | {
      ok: true
      clientSecret: string
      amountUsd: number
      labelCostUsd: number
      buyerPrepaidAppliedUsd: number
      cardChargeUsd: number
    }
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

  const labelCostUsd = roundMoney(rateResolved.rate.amount)
  if (labelCostUsd < 0.5) {
    return { ok: false, error: "Label cost is below the minimum charge.", status: 400 }
  }

  const buyerPrepaidAvailableUsd = buyerPrepaidFromOrderContext(ctx.order)
  const prepaidBreakdown = computeSellerLabelPrepaidAllowanceBreakdown({
    labelCostUsd,
    buyerPrepaidAvailableUsd,
  })

  if (prepaidBreakdown.canPurchaseWithPrepaidAllowance) {
    return {
      ok: false,
      error:
        "This label is covered by the buyer's prepaid flat shipping on this order. Print the label without card payment.",
      status: 400,
    }
  }

  const cardBreakdown = computeSellerLabelCardPaymentBreakdown({
    labelCostUsd,
    buyerPrepaidAvailableUsd,
  })
  const amountCents = Math.round(cardBreakdown.cardChargeUsd * 100)
  if (amountCents < 50) {
    return {
      ok: false,
      error:
        cardBreakdown.buyerPrepaidAppliedUsd > 0
          ? "After applying the buyer's prepaid shipping credit, the remaining amount is below the card minimum. Choose a cheaper rate or print with prepaid shipping alone."
          : "Label cost is below the minimum charge.",
      status: 400,
    }
  }

  const labelCostCents = Math.round(labelCostUsd * 100)
  const buyerPrepaidAppliedCents = Math.round(cardBreakdown.buyerPrepaidAppliedUsd * 100)

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
        label_cost_cents: String(labelCostCents),
        buyer_prepaid_applied_cents: String(buyerPrepaidAppliedCents),
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
      labelCostUsd,
      buyerPrepaidAppliedUsd: cardBreakdown.buyerPrepaidAppliedUsd,
      cardChargeUsd: cardBreakdown.cardChargeUsd,
    }
  } catch (e) {
    console.error("[createSellerShippingLabelPaymentIntent] Stripe:", e)
    return { ok: false, error: "Could not create payment", status: 502 }
  }
}

type LabelPurchaseByPaymentIntentRow = {
  id: string
  orderId: string
  labelUrl: string | null
  trackingNumber: string | null
  trackingCarrier: string | null
  createdAt: string
}

async function findLabelPurchaseByPaymentIntent(
  supabase: SupabaseClient,
  paymentIntentId: string,
): Promise<LabelPurchaseByPaymentIntentRow | null> {
  const { data } = await supabase
    .from("order_shipping_labels")
    .select("id, order_id, label_pdf_url, tracking_number, tracking_carrier, created_at")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle()

  const row = data as {
    id?: string
    order_id?: string
    label_pdf_url?: string | null
    tracking_number?: string | null
    tracking_carrier?: string | null
    created_at?: string
  } | null
  if (!row?.id || !row.order_id) return null
  return {
    id: row.id,
    orderId: row.order_id,
    labelUrl: row.label_pdf_url ?? null,
    trackingNumber: row.tracking_number?.trim() || null,
    trackingCarrier: row.tracking_carrier?.trim() || null,
    createdAt: row.created_at ?? "",
  }
}

function isUniqueViolation(error: { code?: string; message?: string } | null | undefined): boolean {
  return (
    error?.code === "23505" ||
    Boolean(error?.message?.includes("order_shipping_labels_stripe_pi_uidx"))
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Atomically claim the right to call ShipEngine for this PaymentIntent.
 * Stripe webhook + browser `/finalize` both complete the same PI — without a claim,
 * both can buy a label before either inserts a row (double ShipEngine charge).
 */
async function claimSellerLabelPurchaseForPaymentIntent(params: {
  serviceSupabase: SupabaseClient
  orderId: string
  paymentIntentId: string
  rateId: string
}): Promise<
  | { ok: true; claimed: true; claimId: string }
  | { ok: true; claimed: false }
  | { ok: false; error: string; status: number }
> {
  const { data, error } = await params.serviceSupabase
    .from("order_shipping_labels")
    .insert({
      order_id: params.orderId,
      origin: "seller_paid",
      label_pdf_url: null,
      label_storage_path: null,
      tracking_number: null,
      tracking_carrier: null,
      shipengine_rate_id: params.rateId,
      stripe_payment_intent_id: params.paymentIntentId,
    })
    .select("id")
    .maybeSingle()

  if (!error) {
    const claimId = (data as { id?: string } | null)?.id
    if (!claimId) {
      return { ok: false, error: "Could not claim label purchase slot.", status: 500 }
    }
    return { ok: true, claimed: true, claimId }
  }

  if (isUniqueViolation(error)) {
    return { ok: true, claimed: false }
  }

  console.error("[sellerShippingLabelCheckout] claim insert:", error)
  return { ok: false, error: "Could not start label purchase. Try again.", status: 500 }
}

async function waitForCompletedSellerLabelByPaymentIntent(params: {
  serviceSupabase: SupabaseClient
  paymentIntentId: string
  attempts?: number
  intervalMs?: number
}): Promise<LabelPurchaseByPaymentIntentRow | null> {
  const attempts = params.attempts ?? 40
  const intervalMs = params.intervalMs ?? 500
  for (let i = 0; i < attempts; i++) {
    const row = await findLabelPurchaseByPaymentIntent(
      params.serviceSupabase,
      params.paymentIntentId,
    )
    if (row?.trackingNumber) return row
    await sleep(intervalMs)
  }
  return null
}

async function releaseSellerLabelPurchaseClaim(params: {
  serviceSupabase: SupabaseClient
  paymentIntentId: string
}): Promise<void> {
  const { error } = await params.serviceSupabase
    .from("order_shipping_labels")
    .delete()
    .eq("stripe_payment_intent_id", params.paymentIntentId)
    .is("tracking_number", null)
  if (error) {
    console.error("[sellerShippingLabelCheckout] release claim:", error)
  }
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
  /** When set, fill a pre-inserted claim row instead of inserting (card PI path). */
  claimId?: string | null
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
  if (params.claimId) {
    const { data: updatedClaim, error: claimUpdateErr } = await params.serviceSupabase
      .from("order_shipping_labels")
      .update({
        label_pdf_url: params.purchased.labelUrl,
        tracking_number: params.purchased.trackingNumber,
        tracking_carrier: params.purchased.trackingCarrier,
        shipengine_rate_id: params.rateId,
        paperless_qr_url: params.purchased.paperlessQrUrl ?? null,
        paperless_instructions: params.purchased.paperlessInstructions ?? null,
        paperless_handoff_code: params.purchased.paperlessHandoffCode ?? null,
      })
      .eq("id", params.claimId)
      .is("tracking_number", null)
      .select("id")
      .maybeSingle()

    if (claimUpdateErr || !updatedClaim) {
      console.error(
        "[sellerShippingLabelCheckout] claim update:",
        claimUpdateErr?.message ?? "claim missing or already completed",
      )
      return {
        ok: false,
        error: "Label purchased but could not be saved. Contact support.",
        status: 500,
      }
    }
  } else {
    const { error: labelInsertErr } = await params.serviceSupabase.from("order_shipping_labels").insert({
      order_id: params.orderId,
      origin: "seller_paid",
      label_pdf_url: params.purchased.labelUrl,
      label_storage_path: null,
      tracking_number: params.purchased.trackingNumber,
      tracking_carrier: params.purchased.trackingCarrier,
      shipengine_rate_id: params.rateId,
      stripe_payment_intent_id: params.stripePaymentIntentId ?? null,
      paperless_qr_url: params.purchased.paperlessQrUrl ?? null,
      paperless_instructions: params.purchased.paperlessInstructions ?? null,
      paperless_handoff_code: params.purchased.paperlessHandoffCode ?? null,
    })

    if (labelInsertErr) {
      if (isUniqueViolation(labelInsertErr) && params.stripePaymentIntentId) {
        const raced = await findLabelPurchaseByPaymentIntent(
          params.serviceSupabase,
          params.stripePaymentIntentId,
        )
        if (raced?.trackingNumber) {
          return {
            ok: true,
            alreadyProcessed: true,
            labelUrl: raced.labelUrl,
            trackingNumber: raced.trackingNumber,
            orderDisplayNum: formatOrderNumForCustomer(params.orderNum, params.orderId),
          }
        }
      }
      console.error("[sellerShippingLabelCheckout] label insert:", labelInsertErr)
      return { ok: false, error: "Label purchased but could not be saved. Contact support.", status: 500 }
    }
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
  const labelCostCentsRaw = pi.metadata.label_cost_cents?.trim() || ""
  const buyerPrepaidAppliedCentsRaw = pi.metadata.buyer_prepaid_applied_cents?.trim() || ""

  if (!orderId || !sellerId || !rateId || !amountCentsRaw) {
    return { ok: false, error: "Payment is missing label metadata" }
  }

  const amountCents = parseInt(amountCentsRaw, 10)
  if (!Number.isFinite(amountCents) || amountCents < 50 || pi.amount !== amountCents) {
    return { ok: false, error: "Payment amount does not match the selected label rate" }
  }

  if (labelCostCentsRaw && buyerPrepaidAppliedCentsRaw) {
    const labelCostCents = parseInt(labelCostCentsRaw, 10)
    const buyerPrepaidAppliedCents = parseInt(buyerPrepaidAppliedCentsRaw, 10)
    if (
      Number.isFinite(labelCostCents) &&
      Number.isFinite(buyerPrepaidAppliedCents) &&
      labelCostCents >= 50 &&
      buyerPrepaidAppliedCents >= 0 &&
      buyerPrepaidAppliedCents <= labelCostCents &&
      amountCents + buyerPrepaidAppliedCents !== labelCostCents
    ) {
      return { ok: false, error: "Payment amount does not match the selected label rate" }
    }
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
  if (existing?.trackingNumber) {
    const { data: orderRow } = await serviceSupabase
      .from("orders")
      .select("order_num")
      .eq("id", existing.orderId)
      .maybeSingle()
    const orderNum = (orderRow as { order_num?: string | null } | null)?.order_num ?? null
    return {
      ok: true,
      orderId: existing.orderId,
      alreadyProcessed: true,
      labelUrl: existing.labelUrl,
      trackingNumber: existing.trackingNumber,
      orderDisplayNum: formatOrderNumForCustomer(orderNum, existing.orderId),
    }
  }

  if (existing && !existing.trackingNumber) {
    // Another worker already claimed this PI (webhook vs finalize race) — wait for it.
    const completed = await waitForCompletedSellerLabelByPaymentIntent({
      serviceSupabase,
      paymentIntentId: params.paymentIntent.id,
    })
    if (completed?.trackingNumber) {
      const { data: orderRow } = await serviceSupabase
        .from("orders")
        .select("order_num")
        .eq("id", completed.orderId)
        .maybeSingle()
      const orderNum = (orderRow as { order_num?: string | null } | null)?.order_num ?? null
      return {
        ok: true,
        orderId: completed.orderId,
        alreadyProcessed: true,
        labelUrl: completed.labelUrl,
        trackingNumber: completed.trackingNumber,
        orderDisplayNum: formatOrderNumForCustomer(orderNum, completed.orderId),
      }
    }
    return {
      ok: false,
      error: "Label purchase is still in progress. Wait a few seconds and refresh.",
      status: 409,
    }
  }

  const ctx = await loadSellerShippingLabelOrderContext(
    params.supabase,
    meta.orderId,
    meta.sellerId,
  )
  if (!ctx.ok) return ctx

  const claim = await claimSellerLabelPurchaseForPaymentIntent({
    serviceSupabase,
    orderId: meta.orderId,
    paymentIntentId: params.paymentIntent.id,
    rateId: meta.rateId,
  })
  if (!claim.ok) return claim

  if (!claim.claimed) {
    const completed = await waitForCompletedSellerLabelByPaymentIntent({
      serviceSupabase,
      paymentIntentId: params.paymentIntent.id,
    })
    if (completed?.trackingNumber) {
      return {
        ok: true,
        orderId: completed.orderId,
        alreadyProcessed: true,
        labelUrl: completed.labelUrl,
        trackingNumber: completed.trackingNumber,
        orderDisplayNum: formatOrderNumForCustomer(ctx.order.order_num, completed.orderId),
      }
    }
    return {
      ok: false,
      error: "Label purchase is still in progress. Wait a few seconds and refresh.",
      status: 409,
    }
  }

  const purchased = await purchaseShipEngineLabelForOrderOnce({
    supabase: serviceSupabase,
    orderId: meta.orderId,
    ownerKey: `stripe_pi:${params.paymentIntent.id}`,
    rateId: meta.rateId,
  })
  if (!purchased.ok) {
    await releaseSellerLabelPurchaseClaim({
      serviceSupabase,
      paymentIntentId: params.paymentIntent.id,
    })
    return { ok: false, error: purchased.error, status: purchased.status }
  }

  // Another path already bought/saved this order's label — do not write a second tracked row.
  if (purchased.alreadyPurchased) {
    await releaseSellerLabelPurchaseClaim({
      serviceSupabase,
      paymentIntentId: params.paymentIntent.id,
    })
    return {
      ok: true,
      orderId: meta.orderId,
      alreadyProcessed: true,
      labelUrl: purchased.result.labelUrl,
      trackingNumber: purchased.result.trackingNumber,
      orderDisplayNum: formatOrderNumForCustomer(ctx.order.order_num, meta.orderId),
    }
  }

  const saved = await persistSellerPaidLabelAndTracking({
    serviceSupabase,
    orderId: meta.orderId,
    sellerId: meta.sellerId,
    orderNum: ctx.order.order_num,
    rateId: meta.rateId,
    purchased: purchased.result,
    stripePaymentIntentId: params.paymentIntent.id,
    claimId: claim.claimId,
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

export async function resolveSellerShippingLabelPaymentBreakdown(params: {
  supabase: SupabaseClient
  orderId: string
  sellerId: string
  rateId: string
  sellerAddressId?: string | null
  parcel?: { length_in: number; width_in: number; height_in: number; weight_lb: number }
  applyWallet: boolean
}): Promise<
  | {
      ok: true
      breakdown: SellerLabelPaymentBreakdown
      walletSpendableUsd: number
      rateId: string
      orderDisplayNum: string
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

  const walletSummary = await getSellerBalance(params.supabase, params.sellerId)
  const breakdown = computeSellerLabelPaymentBreakdown({
    labelCostUsd: rateResolved.rate.amount,
    buyerPrepaidAvailableUsd: buyerPrepaidFromOrderContext(ctx.order),
    walletSpendableUsd: walletSummary.spendableBucks,
    applyWallet: params.applyWallet,
  })

  return {
    ok: true,
    breakdown,
    walletSpendableUsd: walletSummary.spendableBucks,
    rateId: rateResolved.rate.rate_id,
    orderDisplayNum: formatOrderNumForCustomer(ctx.order.order_num, ctx.order.id),
  }
}

export async function purchaseSellerShippingLabelWithWallet(params: {
  supabase: SupabaseClient
  orderId: string
  sellerId: string
  rateId: string
  sellerAddressId?: string | null
  parcel?: { length_in: number; width_in: number; height_in: number; weight_lb: number }
  /** When false (default), pay from buyer prepaid flat shipping and credit surplus to seller wallet. */
  applyWallet?: boolean
}): Promise<
  | {
      ok: true
      labelUrl: string | null
      trackingNumber: string
      orderDisplayNum: string
      alreadyProcessed: boolean
      amountUsd: number
      walletBalanceAfter: number
      buyerPrepaidAppliedUsd: number
      walletAppliedUsd: number
      shippingSurplusCreditUsd: number
      cardChargeUsd: number
    }
  | { ok: false; error: string; status: number }
> {
  const usePrepaidAllowance = params.applyWallet !== true

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

  const labelCostUsd = roundMoney(rateResolved.rate.amount)
  if (labelCostUsd < 0.5) {
    return { ok: false, error: "Label cost is below the minimum charge.", status: 400 }
  }

  const buyerPrepaidAvailableUsd = buyerPrepaidFromOrderContext(ctx.order)
  const orderDisplayNum = formatOrderNumForCustomer(ctx.order.order_num, ctx.order.id)

  const breakdown = usePrepaidAllowance
    ? computeSellerLabelPrepaidAllowanceBreakdown({ labelCostUsd, buyerPrepaidAvailableUsd })
    : computeSellerLabelPaymentBreakdown({
        labelCostUsd,
        buyerPrepaidAvailableUsd,
        walletSpendableUsd: (await getSellerBalance(params.supabase, params.sellerId)).spendableBucks,
        applyWallet: true,
      })

  if (usePrepaidAllowance) {
    if (!breakdown.canPurchaseWithPrepaidAllowance) {
      return {
        ok: false,
        error:
          breakdown.excessOverPrepaidUsd > 0
            ? `This label costs $${labelCostUsd.toFixed(2)}. Buyer prepaid shipping covers $${buyerPrepaidAvailableUsd.toFixed(2)}; pay the $${breakdown.excessOverPrepaidUsd.toFixed(2)} remainder with card or choose a cheaper rate.`
            : "This order has no buyer prepaid flat shipping for a label purchase.",
        status: 402,
      }
    }
  } else if (breakdown.cardChargeUsd > 0 || breakdown.walletAppliedUsd <= 0) {
    const walletSummary = await getSellerBalance(params.supabase, params.sellerId)
    return {
      ok: false,
      error:
        breakdown.cardChargeUsd > 0
          ? `This label costs $${labelCostUsd.toFixed(2)}. Pay the $${breakdown.cardChargeUsd.toFixed(2)} remainder with card or choose a cheaper rate.`
          : `Insufficient wallet balance. Available: $${walletSummary.spendableBucks.toFixed(2)}`,
      status: 402,
    }
  }

  const serviceClient = await getServiceSupabaseOrError()
  if (!serviceClient.ok) return serviceClient
  const serviceSupabase = serviceClient.client
  const writeDb = getClientForPrivilegedWalletWrites(params.supabase)

  const existingLabel = await findExistingSellerPaidLabelForOrder(serviceSupabase, params.orderId)
  if (existingLabel.ok) {
    const walletSummary = await getSellerBalance(params.supabase, params.sellerId)
    return {
      ok: true,
      labelUrl: existingLabel.labelUrl,
      trackingNumber: existingLabel.trackingNumber,
      orderDisplayNum: existingLabel.orderDisplayNum,
      alreadyProcessed: true,
      amountUsd: labelCostUsd,
      walletBalanceAfter: walletSummary.spendableBucks,
      buyerPrepaidAppliedUsd: breakdown.buyerPrepaidAppliedUsd,
      walletAppliedUsd: breakdown.walletAppliedUsd,
      shippingSurplusCreditUsd: breakdown.shippingSurplusCreditUsd,
      cardChargeUsd: 0,
    }
  }

  let deducted: Awaited<ReturnType<typeof deductWalletForInternalSpendAtomic>> | null = null
  if (!usePrepaidAllowance && breakdown.walletAppliedUsd > 0) {
    const existingWalletTx = await findWalletLabelPurchaseByOrder(serviceSupabase, params.orderId)
    if (existingWalletTx) {
      return {
        ok: false,
        error:
          "Wallet payment was recorded but the label is missing. Contact support with your order number.",
        status: 500,
      }
    }

    try {
      deducted = await deductWalletForInternalSpendAtomic(
        writeDb,
        params.sellerId,
        breakdown.walletAppliedUsd,
      )
    } catch (e) {
      console.error("[purchaseSellerShippingLabelWithWallet] deduct rpc:", e)
      return { ok: false, error: "Could not debit wallet balance", status: 500 }
    }

    if (!deducted) {
      const walletSummary = await getSellerBalance(params.supabase, params.sellerId)
      return {
        ok: false,
        error: `Insufficient wallet balance. Available: $${walletSummary.spendableBucks.toFixed(2)}`,
        status: 400,
      }
    }

    const carrierLabel = rateResolved.rate.carrierLabel.slice(0, 80)
    const serviceName = rateResolved.rate.serviceName.slice(0, 80)
    const { error: walletTxErr } = await writeDb.from("wallet_transactions").insert({
      wallet_id: deducted.walletId,
      user_id: params.sellerId,
      type: "purchase",
      amount: -breakdown.walletAppliedUsd,
      balance_after: deducted.balanceAfter.toFixed(2),
      description: `Shipping label — order #${orderDisplayNum} (${carrierLabel} ${serviceName})`,
      reference_id: params.orderId,
      reference_type: SELLER_SHIPPING_LABEL_WALLET_REFERENCE_TYPE,
    })

    if (walletTxErr) {
      console.error("[purchaseSellerShippingLabelWithWallet] wallet tx insert:", walletTxErr)
      try {
        await refundWalletInternalSpend(writeDb, params.sellerId, breakdown.walletAppliedUsd)
      } catch (refundErr) {
        console.error("[purchaseSellerShippingLabelWithWallet] CRITICAL refund after tx insert fail", refundErr)
      }
      return { ok: false, error: "Could not record wallet payment", status: 500 }
    }
  }

  const refundWalletDebit = async (reason: string) => {
    if (!deducted || breakdown.walletAppliedUsd <= 0) return
    try {
      await refundWalletInternalSpend(writeDb, params.sellerId, breakdown.walletAppliedUsd)
      await writeDb
        .from("wallet_transactions")
        .delete()
        .eq("reference_type", SELLER_SHIPPING_LABEL_WALLET_REFERENCE_TYPE)
        .eq("reference_id", params.orderId)
    } catch (refundErr) {
      console.error(`[purchaseSellerShippingLabelWithWallet] CRITICAL refund after ${reason}`, refundErr)
    }
  }

  const purchased = await purchaseShipEngineLabelForOrderOnce({
    supabase: serviceSupabase,
    orderId: params.orderId,
    ownerKey: `wallet:${params.orderId}`,
    rateId: rateResolved.rate.rate_id,
  })
  if (!purchased.ok) {
    await refundWalletDebit("label purchase fail")
    return { ok: false, error: purchased.error, status: purchased.status }
  }

  if (purchased.alreadyPurchased) {
    await refundWalletDebit("duplicate label already purchased")
    const walletSummary = await getSellerBalance(params.supabase, params.sellerId)
    return {
      ok: true,
      labelUrl: purchased.result.labelUrl,
      trackingNumber: purchased.result.trackingNumber,
      orderDisplayNum,
      alreadyProcessed: true,
      amountUsd: labelCostUsd,
      walletBalanceAfter: walletSummary.spendableBucks,
      buyerPrepaidAppliedUsd: breakdown.buyerPrepaidAppliedUsd,
      walletAppliedUsd: 0,
      shippingSurplusCreditUsd: 0,
      cardChargeUsd: 0,
    }
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
    await refundWalletDebit("label save fail")
    return saved
  }

  let walletBalanceAfter = deducted?.balanceAfter
  if (usePrepaidAllowance) {
    const credited = await creditSellerFlatShippingSurplus({
      writeDb,
      sellerId: params.sellerId,
      orderId: params.orderId,
      orderDisplayNum,
      surplusUsd: breakdown.shippingSurplusCreditUsd,
    })
    if (!credited.ok) {
      console.error(
        "[purchaseSellerShippingLabelWithWallet] label saved but surplus credit failed",
        params.orderId,
      )
      return {
        ok: false,
        error:
          "Label purchased and tracking saved, but unused shipping could not be credited to the seller wallet. Contact support.",
        status: 500,
      }
    }
    walletBalanceAfter = credited.balanceAfter
  }

  if (walletBalanceAfter == null) {
    walletBalanceAfter = (await getSellerBalance(params.supabase, params.sellerId)).spendableBucks
  }

  return {
    ok: true,
    labelUrl: saved.labelUrl,
    trackingNumber: saved.trackingNumber,
    orderDisplayNum: saved.orderDisplayNum,
    alreadyProcessed: saved.alreadyProcessed,
    amountUsd: labelCostUsd,
    walletBalanceAfter,
    buyerPrepaidAppliedUsd: breakdown.buyerPrepaidAppliedUsd,
    walletAppliedUsd: breakdown.walletAppliedUsd,
    shippingSurplusCreditUsd: breakdown.shippingSurplusCreditUsd,
    cardChargeUsd: 0,
  }
}
