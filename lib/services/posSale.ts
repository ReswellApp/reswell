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
import { revalidateBoardsBrowseCatalog } from "@/lib/cache/revalidate-boards-browse-catalog"
import { revalidateSellersAfterListingChange } from "@/lib/cache/revalidate-sellers-directory-catalog"
import { signPosReceiptToken } from "@/lib/services/posReceiptToken"
import { trackKlaviyoPosReceipt } from "@/lib/klaviyo/track-pos-receipt"
import { publicSiteOrigin } from "@/lib/public-site-origin"
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
  | { ok: true; orderId: string; alreadyProcessed?: boolean }
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
    return { ok: false, error: "This board is not consigned to your store.", status: 403 }
  }
  if (listing.status !== "active" || listing.hidden_from_site) {
    return { ok: false, error: "This board is not available for sale.", status: 409 }
  }
  if (!listing.consignor_profile_id) {
    return { ok: false, error: "Board is missing its consignor.", status: 409 }
  }

  const itemPrice = round2(parseFloat(String(listing.price)))
  if (!Number.isFinite(itemPrice) || itemPrice <= 0) {
    return { ok: false, error: "Board has an invalid price.", status: 409 }
  }
  const floor = listing.floor_price == null ? null : round2(parseFloat(String(listing.floor_price)))
  if (floor != null && itemPrice < floor) {
    return { ok: false, error: "Board price is below its floor.", status: 409 }
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
      description: `In-store sale — ${listing.title ?? "consigned board"}`,
      metadata: {
        sales_channel: "pos",
        store_id: input.storeId,
        listing_id: listing.id,
        consignor_id: listing.consignor_profile_id,
        seller_id: listing.user_id,
        pos_staff_profile_id: staffProfileId,
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

  if (listing.consignment_store_id !== storeId || !listing.consignor_profile_id) {
    return { ok: false, error: "Board / store mismatch on this sale.", status: 409 }
  }

  const store = await getConsignmentStoreById(service, storeId)
  if (!store) {
    return { ok: false, error: "Store not found for this sale.", status: 409 }
  }

  const commissionBps = resolveCommissionBps(listing.commission_bps, store.defaultCommissionBps)
  if (commissionBps == null) {
    return { ok: false, error: "Commission not configured for this board.", status: 409 }
  }

  const itemPrice = round2((pi.amount_received ?? pi.amount) / 100)
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
  const split = splitRes.split

  const storeCustomerId = pi.metadata?.store_customer_id?.trim() || null
  const posStaffId = pi.metadata?.pos_staff_profile_id?.trim() || null

  return finalizePosSettlement(service, {
    listing,
    store,
    split,
    itemPrice,
    paymentMethod: "stripe",
    paymentRef: pi.id,
    storeCustomerId,
    posStaffId,
  })
}

type ConsignmentSplitValues = {
  platformFee: number
  sellerEarnings: number
  shopCommissionGross: number
  shopNetEarnings: number
  consignorEarnings: number
}

/**
 * Shared in-store settlement: inserts the POS order, splits earnings into pending wallets, marks the
 * board sold, releases earnings immediately (pickup), notifies the consignor, and emails the receipt.
 * Used by both the card-present (`paymentMethod: 'stripe'`, `paymentRef: pi.id`) and cash
 * (`paymentMethod: 'cash'`, `paymentRef: null`) tenders.
 */
async function finalizePosSettlement(
  service: SupabaseClient,
  args: {
    listing: PosListingRow
    store: NonNullable<Awaited<ReturnType<typeof getConsignmentStoreById>>>
    split: ConsignmentSplitValues
    itemPrice: number
    paymentMethod: "stripe" | "cash"
    paymentRef: string | null
    storeCustomerId: string | null
    posStaffId: string | null
  },
): Promise<CompletePosOrderResult> {
  const { listing, store, split, itemPrice, paymentMethod, paymentRef, storeCustomerId, posStaffId } =
    args
  const consignorProfileId = listing.consignor_profile_id
  if (!consignorProfileId) {
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
      platform_fee: split.platformFee,
      seller_earnings: split.sellerEarnings,
      status: "confirmed",
      payment_method: paymentMethod,
      stripe_checkout_session_id: paymentRef,
      fulfillment_method: "pickup",
      delivery_status: "picked_up",
      sales_channel: "pos",
      consignment_store_id: store.id,
      consignor_profile_id: consignorProfileId,
      shop_commission_gross: split.shopCommissionGross,
      shop_net_earnings: split.shopNetEarnings,
      consignor_earnings: split.consignorEarnings,
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
    platform_fee: split.platformFee,
    seller_earnings: split.sellerEarnings,
  })
  if (itemErr) {
    console.error("[posSale] order_items insert failed", itemErr)
    return { ok: false, error: "Could not create the sale line.", status: 500 }
  }

  const title = String(listing.title ?? "")

  const consignorCredit = await creditOrderPendingEarnings(service, {
    userId: consignorProfileId,
    amountUsd: split.consignorEarnings,
    orderId: purchase.id,
    description: walletPendingConsignorDescription(title),
    referenceType: "consignment_order_pending_consignor",
  })
  if (!consignorCredit.ok) return consignorCredit

  const shopCredit = await creditOrderPendingEarnings(service, {
    userId: listing.user_id,
    amountUsd: split.shopNetEarnings,
    orderId: purchase.id,
    description: walletPendingShopCommissionDescription(title, split.platformFee),
    referenceType: "consignment_order_pending_shop",
  })
  if (!shopCredit.ok) return shopCredit

  const { error: soldErr } = await service
    .from("listings")
    .update({ status: "sold" })
    .eq("id", listing.id)
  if (soldErr) {
    console.error("[posSale] mark sold failed", soldErr)
    return { ok: false, error: "Could not mark the board sold.", status: 500 }
  }

  // In-store handoff is immediate: release pending → available right away (pickup, no shipping gate).
  // The order is already committed; a release hiccup is logged and can be re-driven, never fails the sale.
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

  revalidateBoardsBrowseCatalog()
  await revalidateSellersAfterListingChange(service, listing.user_id)

  // Notify the consignor their board sold (best-effort).
  void notifyConsignorSold(service, purchase.id)

  // Receipt: if we captured the walk-in customer, email them their receipt via the existing
  // Klaviyo pipeline (with a "create your account" CTA). Best-effort, never blocks settlement.
  if (storeCustomerId) {
    void sendPosReceipt(service, {
      orderId: purchase.id,
      storeCustomerId,
      storeName: store.name,
      listingTitle: String(listing.title ?? "your board"),
      amountUsd: itemPrice,
    })
  }

  return { ok: true, orderId: purchase.id }
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
    return { ok: false, error: "This board is not consigned to your store.", status: 403 }
  }
  if (listing.status !== "active" || listing.hidden_from_site) {
    return { ok: false, error: "This board is not available for sale.", status: 409 }
  }
  if (!listing.consignor_profile_id) {
    return { ok: false, error: "Board is missing its consignor.", status: 409 }
  }

  const itemPrice = round2(parseFloat(String(listing.price)))
  if (!Number.isFinite(itemPrice) || itemPrice <= 0) {
    return { ok: false, error: "Board has an invalid price.", status: 409 }
  }
  const floor = listing.floor_price == null ? null : round2(parseFloat(String(listing.floor_price)))
  if (floor != null && itemPrice < floor) {
    return { ok: false, error: "Board price is below its floor.", status: 409 }
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

  return finalizePosSettlement(service, {
    listing,
    store,
    split: splitRes.split,
    itemPrice,
    paymentMethod: "cash",
    paymentRef: null,
    storeCustomerId,
    posStaffId: staffProfileId,
  })
}

async function sendPosReceipt(
  service: SupabaseClient,
  params: {
    orderId: string
    storeCustomerId: string
    storeName: string
    listingTitle: string
    amountUsd: number
  },
): Promise<void> {
  try {
    const { data: customer } = await service
      .from("store_customers")
      .select("email, first_name, last_name")
      .eq("id", params.storeCustomerId)
      .maybeSingle()
    const email = (customer as { email?: string } | null)?.email?.trim()
    if (!email) return

    const token = signPosReceiptToken(params.orderId)
    if (!token) return
    const receiptUrl = `${publicSiteOrigin()}/receipt/${token}`

    await trackKlaviyoPosReceipt({
      orderId: params.orderId,
      customerEmail: email,
      customerFirstName: (customer as { first_name?: string | null } | null)?.first_name ?? null,
      customerLastName: (customer as { last_name?: string | null } | null)?.last_name ?? null,
      storeName: params.storeName,
      listingTitle: params.listingTitle,
      amountUsd: params.amountUsd,
      receiptUrl,
    })
  } catch (e) {
    console.error("[posSale] receipt send failed", { orderId: params.orderId, e })
  }
}
