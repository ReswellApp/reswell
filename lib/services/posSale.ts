import { randomUUID } from "crypto"
import type Stripe from "stripe"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getStripe } from "@/lib/stripe-server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { getConsignmentStoreById, getStoreStaffRole } from "@/lib/db/consignmentStores"
import {
  computeConsignmentSplit,
  resolveCommissionBps,
} from "@/lib/services/consignmentSplit"
import {
  creditOrderPendingEarnings,
  walletPendingConsignorDescription,
  walletPendingShopCommissionDescription,
} from "@/lib/services/orderPendingEarnings"
import { releaseOrderSellerEarningsAfterFulfillment } from "@/lib/services/releaseOrderSellerEarnings"
import { notifyConsignorSold } from "@/lib/services/notifyConsignorSold"
import { processPaymentOnReader, cancelReaderAction } from "@/lib/services/stripeTerminal"
import { captureStoreCustomer } from "@/lib/services/storeCustomers"
import { sendPosReceiptEmailForOrder } from "@/lib/services/posReceiptEmail"
import { markListingSoldForCheckout } from "@/lib/services/listingSoldSiteEffects"
import { ensurePosOrderListingMarkedSold } from "@/lib/services/reconcileListingSoldOrders"
import { getSellerEarnings } from "@/lib/seller-fees"
import { isShopOwnedStoreListing } from "@/lib/utils/store-inventory-kind"
import type { PosSaleStartInput, PosCashSaleInput } from "@/lib/validations/consignment"

const POS_LISTING_SELECT =
  "id, title, slug, price, status, hidden_from_site, user_id, consignment_store_id, consignor_profile_id, floor_price, commission_bps"

type PosListingRow = {
  id: string
  title: string | null
  slug: string | null
  price: string | number
  status: string
  hidden_from_site: boolean | null
  user_id: string
  consignment_store_id: string | null
  consignor_profile_id: string | null
  floor_price: string | number | null
  commission_bps: number | null
}

export type StartPosSaleResult =
  | { ok: true; paymentIntentId: string; readerId: string; amountUsd: number }
  | { ok: false; error: string; status: number }

export type CompletePosOrderResult =
  | {
      ok: true
      orderId: string
      alreadyProcessed?: boolean
      receiptEmailSent?: boolean
      customerEmail?: string | null
    }
  | { ok: false; error: string; status: number }

function isUniqueViolation(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false
  if (err.code === "23505") return true
  return Boolean(err.message?.toLowerCase().includes("duplicate"))
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Begins an in-store card-present sale: validates the consigned board belongs to this store, optionally
 * captures the walk-in customer, creates a `card_present` PaymentIntent tagged for POS settlement, then
 * tells the chosen WisePOS reader to collect payment. Settlement runs on success (webhook + finalize).
 */
export async function startPosSale(
  staffProfileId: string,
  input: PosSaleStartInput,
): Promise<StartPosSaleResult> {
  let service: SupabaseClient
  try {
    service = createServiceRoleClient()
  } catch {
    return { ok: false, error: "Server configuration error", status: 503 }
  }

  const role = await getStoreStaffRole(service, input.storeId, staffProfileId)
  if (!role) {
    return { ok: false, error: "Only store staff can ring up a sale.", status: 403 }
  }

  const store = await getConsignmentStoreById(service, input.storeId)
  if (!store || store.status !== "active") {
    return { ok: false, error: "Store is not active.", status: 409 }
  }

  const { data: listingRaw, error: listingErr } = await service
    .from("listings")
    .select(POS_LISTING_SELECT)
    .eq("id", input.listingId)
    .maybeSingle()

  if (listingErr || !listingRaw) {
    return { ok: false, error: "Board not found.", status: 404 }
  }
  const listing = listingRaw as PosListingRow

  if (listing.consignment_store_id !== input.storeId) {
    return { ok: false, error: "This board is not in your store inventory.", status: 403 }
  }
  if (listing.status !== "active" || listing.hidden_from_site) {
    return { ok: false, error: "This board is not available for sale.", status: 409 }
  }

  const shopOwned = isShopOwnedStoreListing(listing)

  const itemPrice = round2(parseFloat(String(listing.price)))
  if (!Number.isFinite(itemPrice) || itemPrice <= 0) {
    return { ok: false, error: "Board has an invalid price.", status: 409 }
  }
  if (!shopOwned) {
    if (!listing.consignor_profile_id) {
      return { ok: false, error: "Board is missing its consignor.", status: 409 }
    }
    const floor = listing.floor_price == null ? null : round2(parseFloat(String(listing.floor_price)))
    if (floor != null && itemPrice < floor) {
      return { ok: false, error: "Board price is below its floor.", status: 409 }
    }
  }

  // Optional walk-in customer capture (deduped by store+email).
  let storeCustomerId: string | null = null
  const customer = input.customer
  if (customer?.email && customer?.firstName) {
    const captured = await captureStoreCustomer(staffProfileId, {
      storeId: input.storeId,
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      phoneE164: customer.phoneE164,
    })
    if (captured.ok) {
      storeCustomerId = captured.customerId
    }
  }

  const stripe = getStripe()
  let pi: Stripe.PaymentIntent
  try {
    pi = await stripe.paymentIntents.create({
      amount: Math.round(itemPrice * 100),
      currency: "usd",
      payment_method_types: ["card_present"],
      capture_method: "automatic",
      description: `In-store sale — ${listing.title ?? "store item"}`,
      metadata: {
        sales_channel: "pos",
        store_id: input.storeId,
        listing_id: listing.id,
        seller_id: listing.user_id,
        pos_staff_profile_id: staffProfileId,
        inventory_kind: shopOwned ? "shop_owned" : "consignment",
        ...(listing.consignor_profile_id ? { consignor_id: listing.consignor_profile_id } : {}),
        ...(storeCustomerId ? { store_customer_id: storeCustomerId } : {}),
      },
    })
  } catch (e) {
    console.error("[posSale] create payment intent failed", e)
    return { ok: false, error: "Could not start the payment.", status: 502 }
  }

  try {
    await processPaymentOnReader(input.readerId, pi.id)
  } catch (e) {
    console.error("[posSale] process on reader failed", e)
    try {
      await stripe.paymentIntents.cancel(pi.id)
    } catch {
      // best-effort cleanup
    }
    return {
      ok: false,
      error: "Couldn't reach the card reader. Check it's online and try again.",
      status: 502,
    }
  }

  return { ok: true, paymentIntentId: pi.id, readerId: input.readerId, amountUsd: itemPrice }
}

/**
 * Settles a POS sale once its card-present PaymentIntent has succeeded. Mirrors the online consignment
 * settlement (same 3-way split + pending-wallet ledger), but with `sales_channel = 'pos'`, no Reswell
 * buyer, and immediate pickup release (the customer walks out with the board). Idempotent per PI.
 */
export async function completePosOrderFromPaymentIntent(
  pi: Stripe.PaymentIntent,
): Promise<CompletePosOrderResult> {
  if (pi.metadata?.sales_channel !== "pos") {
    return { ok: false, error: "Not a POS payment.", status: 400 }
  }
  const listingId = pi.metadata?.listing_id?.trim()
  const storeId = pi.metadata?.store_id?.trim()
  if (!listingId || !storeId) {
    return { ok: false, error: "POS payment is missing item metadata.", status: 400 }
  }

  let service: SupabaseClient
  try {
    service = createServiceRoleClient()
  } catch {
    return { ok: false, error: "Server configuration error", status: 503 }
  }

  // Idempotency: this PI may have already settled (webhook + finalize race).
  const { data: existing } = await service
    .from("orders")
    .select("id")
    .eq("stripe_checkout_session_id", pi.id)
    .maybeSingle()
  if (existing?.id) {
    const { data: listingRaw } = await service
      .from("listings")
      .select(POS_LISTING_SELECT)
      .eq("id", listingId)
      .maybeSingle()
    if (listingRaw) {
      const itemPrice = round2((pi.amount_received ?? pi.amount) / 100)
      await ensurePosOrderListingMarkedSold(service, listingRaw as PosListingRow, itemPrice)
    }
    return { ok: true, orderId: existing.id, alreadyProcessed: true }
  }

  const { data: listingRaw, error: listingErr } = await service
    .from("listings")
    .select(POS_LISTING_SELECT)
    .eq("id", listingId)
    .maybeSingle()
  if (listingErr || !listingRaw) {
    return { ok: false, error: "Board not found for this sale.", status: 404 }
  }
  const listing = listingRaw as PosListingRow

  if (listing.consignment_store_id !== storeId) {
    return { ok: false, error: "Board / store mismatch on this sale.", status: 409 }
  }

  const store = await getConsignmentStoreById(service, storeId)
  if (!store) {
    return { ok: false, error: "Store not found for this sale.", status: 409 }
  }

  const itemPrice = round2((pi.amount_received ?? pi.amount) / 100)
  const storeCustomerId = pi.metadata?.store_customer_id?.trim() || null
  const posStaffId = pi.metadata?.pos_staff_profile_id?.trim() || null

  if (isShopOwnedStoreListing(listing)) {
    const { marketplaceFee, sellerEarnings } = getSellerEarnings(itemPrice)
    return finalizePosSettlement(service, {
      listing,
      store,
      itemPrice,
      paymentMethod: "stripe",
      paymentRef: pi.id,
      storeCustomerId,
      posStaffId,
      shopOwned: {
        platformFee: marketplaceFee,
        sellerEarnings,
      },
    })
  }

  if (!listing.consignor_profile_id) {
    return { ok: false, error: "Board is missing its consignor.", status: 409 }
  }

  const commissionBps = resolveCommissionBps(listing.commission_bps, store.defaultCommissionBps)
  if (commissionBps == null) {
    return { ok: false, error: "Commission not configured for this board.", status: 409 }
  }

  const floor = listing.floor_price == null ? null : round2(parseFloat(String(listing.floor_price)))
  if (floor != null && itemPrice < floor) {
    console.error("[posSale] floor violation at settlement", { pi: pi.id, itemPrice, floor })
    return { ok: false, error: "Sale price is below the consignor's floor.", status: 409 }
  }

  const splitRes = computeConsignmentSplit({
    itemPriceUsd: itemPrice,
    commissionBps,
    reswellFeeBps: store.reswellFeeBps,
  })
  if (!splitRes.ok) {
    return { ok: false, error: splitRes.error, status: 409 }
  }

  return finalizePosSettlement(service, {
    listing,
    store,
    itemPrice,
    paymentMethod: "stripe",
    paymentRef: pi.id,
    storeCustomerId,
    posStaffId,
    consignment: splitRes.split,
  })
}

type ConsignmentSplitValues = {
  platformFee: number
  sellerEarnings: number
  shopCommissionGross: number
  shopNetEarnings: number
  consignorEarnings: number
}

type ShopOwnedPosEarnings = {
  platformFee: number
  sellerEarnings: number
}

type FinalizePosSettlementArgs = {
  listing: PosListingRow
  store: NonNullable<Awaited<ReturnType<typeof getConsignmentStoreById>>>
  itemPrice: number
  paymentMethod: "stripe" | "cash"
  paymentRef: string | null
  storeCustomerId: string | null
  posStaffId: string | null
} & (
  | { consignment: ConsignmentSplitValues; shopOwned?: never }
  | { shopOwned: ShopOwnedPosEarnings; consignment?: never }
)

/**
 * Shared in-store settlement: inserts the POS order, credits pending wallets, marks the board sold,
 * releases earnings immediately (pickup), notifies the consignor when applicable, and emails receipt.
 */
async function finalizePosSettlement(
  service: SupabaseClient,
  args: FinalizePosSettlementArgs,
): Promise<CompletePosOrderResult> {
  const { listing, store, itemPrice, paymentMethod, paymentRef, storeCustomerId, posStaffId } = args
  const shopOwned = "shopOwned" in args && args.shopOwned != null
  const split = shopOwned ? null : args.consignment
  if (!shopOwned && !split) {
    return { ok: false, error: "Settlement split is missing.", status: 500 }
  }

  const platformFee = shopOwned ? args.shopOwned.platformFee : split!.platformFee
  const sellerEarnings = shopOwned ? args.shopOwned.sellerEarnings : split!.sellerEarnings
  const consignorProfileId = shopOwned ? null : listing.consignor_profile_id
  if (!shopOwned && !consignorProfileId) {
    return { ok: false, error: "Board is missing its consignor.", status: 409 }
  }

  const orderId = randomUUID()

  const { data: purchase, error: insertError } = await service
    .from("orders")
    .insert({
      id: orderId,
      listing_id: listing.id,
      buyer_id: null,
      seller_id: listing.user_id,
      amount: itemPrice,
      shipping_amount: 0,
      platform_fee: platformFee,
      seller_earnings: sellerEarnings,
      status: "confirmed",
      payment_method: paymentMethod,
      stripe_checkout_session_id: paymentRef,
      fulfillment_method: "pickup",
      delivery_status: "picked_up",
      sales_channel: "pos",
      consignment_store_id: store.id,
      consignor_profile_id: consignorProfileId,
      shop_commission_gross: shopOwned ? null : split!.shopCommissionGross,
      shop_net_earnings: shopOwned ? sellerEarnings : split!.shopNetEarnings,
      consignor_earnings: shopOwned ? null : split!.consignorEarnings,
      store_customer_id: storeCustomerId,
      pos_staff_profile_id: posStaffId,
    })
    .select("id")
    .single()

  if (insertError || !purchase) {
    if (paymentRef && isUniqueViolation(insertError)) {
      const { data: raced } = await service
        .from("orders")
        .select("id")
        .eq("stripe_checkout_session_id", paymentRef)
        .maybeSingle()
      if (raced?.id) {
        await ensurePosOrderListingMarkedSold(service, listing, itemPrice)
        return { ok: true, orderId: raced.id, alreadyProcessed: true }
      }
    }
    console.error("[posSale] order insert failed", insertError)
    return { ok: false, error: "Could not create the sale.", status: 500 }
  }

  const { error: itemErr } = await service.from("order_items").insert({
    order_id: purchase.id,
    listing_id: listing.id,
    sort_order: 0,
    item_price: itemPrice,
    shipping_amount: 0,
    platform_fee: platformFee,
    seller_earnings: sellerEarnings,
  })
  if (itemErr) {
    console.error("[posSale] order_items insert failed", itemErr)
    return { ok: false, error: "Could not create the sale line.", status: 500 }
  }

  const title = String(listing.title ?? "")

  if (shopOwned) {
    const sellerCredit = await creditOrderPendingEarnings(service, {
      userId: listing.user_id,
      amountUsd: sellerEarnings,
      orderId: purchase.id,
      description: `Pending sale: ${title}`,
      referenceType: "order_pending_earnings",
    })
    if (!sellerCredit.ok) return sellerCredit
  } else {
    const consignorCredit = await creditOrderPendingEarnings(service, {
      userId: consignorProfileId!,
      amountUsd: split!.consignorEarnings,
      orderId: purchase.id,
      description: walletPendingConsignorDescription(title),
      referenceType: "consignment_order_pending_consignor",
    })
    if (!consignorCredit.ok) return consignorCredit

    const shopCredit = await creditOrderPendingEarnings(service, {
      userId: listing.user_id,
      amountUsd: split!.shopNetEarnings,
      orderId: purchase.id,
      description: walletPendingShopCommissionDescription(title, split!.platformFee),
      referenceType: "consignment_order_pending_shop",
    })
    if (!shopCredit.ok) return shopCredit
  }

  const marked = await markListingSoldForCheckout(service, {
    listingId: listing.id,
    listingSlug: listing.slug,
    sellerUserId: listing.user_id,
    soldPriceUsd: itemPrice,
  })
  if (!marked.ok) {
    await ensurePosOrderListingMarkedSold(service, listing, itemPrice)
    const retry = await markListingSoldForCheckout(service, {
      listingId: listing.id,
      listingSlug: listing.slug,
      sellerUserId: listing.user_id,
      soldPriceUsd: itemPrice,
    })
    if (!retry.ok) {
      console.error("[posSale] mark sold failed after order insert", {
        orderId: purchase.id,
        listingId: listing.id,
        error: retry.error,
      })
      return { ok: false, error: "Could not mark the board sold.", status: 500 }
    }
  }

  try {
    const released = await releaseOrderSellerEarningsAfterFulfillment(purchase.id)
    if (!released.ok) {
      console.error("[posSale] earnings release failed (will retry-able)", {
        orderId: purchase.id,
        error: released.error,
      })
    }
  } catch (e) {
    console.error("[posSale] earnings release threw", { orderId: purchase.id, e })
  }

  if (!shopOwned) {
    void notifyConsignorSold(service, purchase.id)
  }

  if (storeCustomerId) {
    const sent = await sendPosReceiptEmailForOrder(service, purchase.id)
    return {
      ok: true,
      orderId: purchase.id,
      receiptEmailSent: sent.ok,
      customerEmail: sent.ok ? sent.customerEmail : null,
    }
  }

  return { ok: true, orderId: purchase.id, receiptEmailSent: false, customerEmail: null }
}

/**
 * Cash tender: settles an in-store sale paid in cash (no Stripe). Validates the board and store like
 * a card sale, optionally captures the walk-in customer, then runs the shared settlement with
 * `payment_method = 'cash'`. The shop physically collects the cash; Reswell still records the split
 * and pays the consignor their share from the shop's wallet, same as a card sale.
 */
export async function completePosCashSale(
  staffProfileId: string,
  input: PosCashSaleInput,
): Promise<CompletePosOrderResult> {
  let service: SupabaseClient
  try {
    service = createServiceRoleClient()
  } catch {
    return { ok: false, error: "Server configuration error", status: 503 }
  }

  const role = await getStoreStaffRole(service, input.storeId, staffProfileId)
  if (!role) {
    return { ok: false, error: "Only store staff can ring up a sale.", status: 403 }
  }

  const store = await getConsignmentStoreById(service, input.storeId)
  if (!store || store.status !== "active") {
    return { ok: false, error: "Store is not active.", status: 409 }
  }

  const { data: listingRaw, error: listingErr } = await service
    .from("listings")
    .select(POS_LISTING_SELECT)
    .eq("id", input.listingId)
    .maybeSingle()
  if (listingErr || !listingRaw) {
    return { ok: false, error: "Board not found.", status: 404 }
  }
  const listing = listingRaw as PosListingRow

  if (listing.consignment_store_id !== input.storeId) {
    return { ok: false, error: "This board is not in your store inventory.", status: 403 }
  }
  if (listing.status !== "active" || listing.hidden_from_site) {
    return { ok: false, error: "This board is not available for sale.", status: 409 }
  }

  const shopOwned = isShopOwnedStoreListing(listing)

  const itemPrice = round2(parseFloat(String(listing.price)))
  if (!Number.isFinite(itemPrice) || itemPrice <= 0) {
    return { ok: false, error: "Board has an invalid price.", status: 409 }
  }
  if (!shopOwned) {
    if (!listing.consignor_profile_id) {
      return { ok: false, error: "Board is missing its consignor.", status: 409 }
    }
    const floor = listing.floor_price == null ? null : round2(parseFloat(String(listing.floor_price)))
    if (floor != null && itemPrice < floor) {
      return { ok: false, error: "Board price is below its floor.", status: 409 }
    }
  }

  let storeCustomerId: string | null = null
  const customer = input.customer
  if (customer?.email && customer?.firstName) {
    const captured = await captureStoreCustomer(staffProfileId, {
      storeId: input.storeId,
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      phoneE164: customer.phoneE164,
    })
    if (captured.ok) {
      storeCustomerId = captured.customerId
    }
  }

  if (shopOwned) {
    const { marketplaceFee, sellerEarnings } = getSellerEarnings(itemPrice)
    return finalizePosSettlement(service, {
      listing,
      store,
      itemPrice,
      paymentMethod: "cash",
      paymentRef: null,
      storeCustomerId,
      posStaffId: staffProfileId,
      shopOwned: {
        platformFee: marketplaceFee,
        sellerEarnings,
      },
    })
  }

  const commissionBps = resolveCommissionBps(listing.commission_bps, store.defaultCommissionBps)
  if (commissionBps == null) {
    return { ok: false, error: "Commission not configured for this board.", status: 409 }
  }

  const splitRes = computeConsignmentSplit({
    itemPriceUsd: itemPrice,
    commissionBps,
    reswellFeeBps: store.reswellFeeBps,
  })
  if (!splitRes.ok) {
    return { ok: false, error: splitRes.error, status: 409 }
  }

  return finalizePosSettlement(service, {
    listing,
    store,
    itemPrice,
    paymentMethod: "cash",
    paymentRef: null,
    storeCustomerId,
    posStaffId: staffProfileId,
    consignment: splitRes.split,
  })
}
