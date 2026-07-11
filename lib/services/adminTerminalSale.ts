import type Stripe from "stripe"
import type { SupabaseClient } from "@supabase/supabase-js"
import { randomUUID } from "node:crypto"
import { isAnonymousSupabaseUser } from "@/lib/auth/is-anonymous-user"
import { getStripe, getStripeCheckoutKeyConfigError } from "@/lib/stripe-server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { getAuthEmailForUserId } from "@/lib/klaviyo/auth-user-email"
import { deleteBuyerCartRowsForListings } from "@/lib/db/cart-items-server"
import {
  PEER_SURFBOARD_CHECKOUT_LISTING_SELECT,
  type PeerSurfboardCheckoutListingRow,
} from "@/lib/services/peerListingShippingQuote"
import { isPeerListingSection } from "@/lib/peer-listing-sections"
import { fetchSellerFeeWaived } from "@/lib/db/profileSellerFee"
import { getSellerEarnings } from "@/lib/seller-fees"
import { completeMarketplaceOrderFromPaymentIntent } from "@/lib/stripe-complete-order"
import { safeRevalidateAfterMarketplaceOrderCommit } from "@/lib/cache/safe-revalidate-after-order"
import { markUserListingBoardModelDataSold } from "@/lib/db/user-listing-board-model-data"
import { touchUserLastActive } from "@/lib/db/userActivity"
import { postPurchaseThreadNotification } from "@/lib/purchase-thread-notification"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import { trackKlaviyoBuyerOrderConfirmed } from "@/lib/klaviyo/track-buyer-order-confirmed"
import type { KlaviyoBuyerOrderLineItem } from "@/lib/klaviyo/track-buyer-order-confirmed"
import { notifySellerOrderCheckoutKlaviyo } from "@/lib/services/notifySellerOrderCheckoutKlaviyo"
import { syncListingToGoogleMerchantBestEffort } from "@/lib/services/googleMerchantSync"
import { trackMetaPurchaseServerEvent } from "@/lib/meta/track-purchase-server-event"
import { syncAdminTerminalGuestToCrm } from "@/lib/services/crmAdminTerminalGuest"
import {
  cancelReaderAction,
  getStripeTerminalLocationId,
  processPaymentOnReader,
  setTerminalReaderCartDisplay,
} from "@/lib/services/stripeTerminal"
import type {
  AdminTerminalSaleCheckoutInput,
  AdminTerminalSaleStartInput,
} from "@/lib/validations/adminTerminalSale"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const ADMIN_TERMINAL_SALES_CHANNEL = "admin_terminal"

/** Synthetic orders.stripe_checkout_session_id prefix for admin register cash sales. */
export const ADMIN_TERMINAL_CASH_REFERENCE_PREFIX = "admin_terminal_cash_"

/** In-person terminal sales always settle as pickup — item price only, no shipping. */
export const ADMIN_TERMINAL_FULFILLMENT = "pickup" as const

export type AdminTerminalInPersonTotals = {
  itemPrice: number
  totalUsd: number
  platformFee: number
  sellerEarnings: number
}

/**
 * Admin in-person checkout ignores listing pickup/shipping flags — charge list price only.
 */
export async function computeAdminTerminalInPersonCheckoutUsd(
  supabase: SupabaseClient,
  listing: PeerSurfboardCheckoutListingRow,
): Promise<{ ok: true; totals: AdminTerminalInPersonTotals } | { ok: false; error: string }> {
  const itemPrice = Math.round(parseFloat(String(listing.price)) * 100) / 100
  if (!Number.isFinite(itemPrice) || itemPrice <= 0) {
    return { ok: false, error: "Invalid listing price" }
  }

  const feeWaived = await fetchSellerFeeWaived(listing.user_id)
  const { marketplaceFee: platformFee, sellerEarnings } = getSellerEarnings(itemPrice, { feeWaived })

  return {
    ok: true,
    totals: {
      itemPrice,
      totalUsd: itemPrice,
      platformFee,
      sellerEarnings,
    },
  }
}

type ListingRef = { kind: "id" | "slug"; value: string }

type AdminTerminalListingRow = PeerSurfboardCheckoutListingRow & {
  hidden_from_site: boolean | null
  archived_at: string | null
}

export type AdminTerminalListingPreview = {
  id: string
  title: string
  slug: string | null
  sellerId: string
  status: string
  itemPrice: number
  shippingPrice: number
  pickupAvailable: boolean
  shippingAvailable: boolean
  suggestedFulfillment: "pickup" | "shipping"
  coverUrl: string | null
}

export type StartAdminTerminalSaleResult =
  | { ok: true; paymentIntentId: string; readerId: string; amountUsd: number }
  | { ok: false; error: string; status: number }

export type StartAdminTerminalCardCheckoutResult =
  | { ok: true; paymentIntentId: string; clientSecret: string; amountUsd: number }
  | { ok: false; error: string; status: number }

type AdminTerminalSaleParties = {
  customerFirstName: string
  customerLastName: string | null
  customerName: string
  customerEmail: string
  customerPhone: string | null
  linkedBuyerId?: string
}

export type FinalizeAdminTerminalSaleResult =
  | { ok: true; orderId: string; alreadyProcessed?: boolean }
  | { ok: false; error: string; status: number }

export type CompleteAdminTerminalCashSaleResult =
  | { ok: true; orderId: string; alreadyProcessed?: boolean }
  | { ok: false; error: string; status: number }

function isUniqueViolation(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false
  if (err.code === "23505") return true
  return Boolean(err.message?.toLowerCase().includes("duplicate"))
}

function terminalGuestShippingJson(parties: AdminTerminalSaleParties): Record<string, unknown> {
  return {
    name: parties.customerName,
    email: parties.customerEmail,
    phone: parties.customerPhone,
    admin_terminal: true,
  }
}

function extractListingRefFromInput(raw: string): ListingRef {
  const trimmed = raw.trim()
  if (!trimmed) return { kind: "slug", value: "" }

  let candidate = trimmed
  if (/^https?:\/\//i.test(candidate)) {
    try {
      const url = new URL(candidate)
      const segments = url.pathname.split("/").filter(Boolean)
      const last = segments[segments.length - 1] ?? ""
      if (last) candidate = last
    } catch {
      /* use raw input */
    }
  }

  if (UUID_REGEX.test(candidate)) {
    return { kind: "id", value: candidate }
  }

  return { kind: "slug", value: candidate }
}

async function loadListingForAdminTerminal(
  serviceSupabase: SupabaseClient,
  listingRef: string,
): Promise<
  | { ok: true; listing: AdminTerminalListingRow }
  | { ok: false; error: string; status: number }
> {
  const ref = extractListingRefFromInput(listingRef)
  if (!ref.value) {
    return { ok: false, error: "Enter a listing UUID, slug, or gear URL", status: 400 }
  }

  let query = serviceSupabase
    .from("listings")
    .select(`${PEER_SURFBOARD_CHECKOUT_LISTING_SELECT}, hidden_from_site, archived_at`)
    .limit(1)

  query = ref.kind === "id" ? query.eq("id", ref.value) : query.eq("slug", ref.value)

  const { data, error } = await query.maybeSingle()
  if (error) {
    console.error("[adminTerminalSale] listing lookup:", error.message)
    return { ok: false, error: "Could not load listing", status: 500 }
  }
  if (!data) {
    return { ok: false, error: "Listing not found", status: 404 }
  }

  const listing = data as AdminTerminalListingRow
  if (listing.archived_at) {
    return { ok: false, error: "Listing is archived", status: 400 }
  }
  if (!["active", "pending_sale"].includes(listing.status)) {
    return {
      ok: false,
      error: `Listing status is "${listing.status}" — use an active or pending_sale listing`,
      status: 400,
    }
  }
  if (!isPeerListingSection(listing.section)) {
    return { ok: false, error: "This listing cannot be sold through marketplace checkout", status: 400 }
  }

  return { ok: true, listing }
}

async function loadListingCoverUrl(
  serviceSupabase: SupabaseClient,
  listingId: string,
): Promise<string | null> {
  const { data } = await serviceSupabase
    .from("listing_images")
    .select("url")
    .eq("listing_id", listingId)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle()

  return typeof data?.url === "string" ? data.url : null
}

export async function previewAdminTerminalListing(
  serviceSupabase: SupabaseClient,
  listingRef: string,
): Promise<
  | { ok: true; preview: AdminTerminalListingPreview }
  | { ok: false; error: string; status: number }
> {
  const loaded = await loadListingForAdminTerminal(serviceSupabase, listingRef)
  if (!loaded.ok) return loaded

  return buildListingPreview(serviceSupabase, loaded.listing)
}

export async function previewAdminTerminalListingById(
  serviceSupabase: SupabaseClient,
  listingId: string,
): Promise<
  | { ok: true; preview: AdminTerminalListingPreview }
  | { ok: false; error: string; status: number }
> {
  const { data, error } = await serviceSupabase
    .from("listings")
    .select(`${PEER_SURFBOARD_CHECKOUT_LISTING_SELECT}, hidden_from_site, archived_at`)
    .eq("id", listingId)
    .maybeSingle()

  if (error) {
    console.error("[adminTerminalSale] listing by id:", error.message)
    return { ok: false, error: "Could not load listing", status: 500 }
  }
  if (!data) {
    return { ok: false, error: "Listing not found", status: 404 }
  }

  const listing = data as AdminTerminalListingRow
  if (listing.archived_at) {
    return { ok: false, error: "Listing is archived", status: 400 }
  }
  if (!["active", "pending_sale"].includes(listing.status)) {
    return {
      ok: false,
      error: `Listing status is "${listing.status}" — use an active or pending_sale listing`,
      status: 400,
    }
  }
  if (!isPeerListingSection(listing.section)) {
    return { ok: false, error: "This listing cannot be sold through marketplace checkout", status: 400 }
  }

  return buildListingPreview(serviceSupabase, listing)
}

async function buildListingPreview(
  serviceSupabase: SupabaseClient,
  listing: AdminTerminalListingRow,
): Promise<
  | { ok: true; preview: AdminTerminalListingPreview }
  | { ok: false; error: string; status: number }
> {
  const pickupAvailable = listing.local_pickup !== false
  const shippingAvailable = Boolean(listing.shipping_available)
  const itemPrice = Math.round(parseFloat(String(listing.price)) * 100) / 100
  const shippingPrice = Math.max(
    0,
    Math.round(parseFloat(String(listing.shipping_price ?? 0)) * 100) / 100,
  )

  const suggestedFulfillment: "pickup" | "shipping" =
    pickupAvailable && !shippingAvailable
      ? "pickup"
      : !pickupAvailable && shippingAvailable
        ? "shipping"
        : "pickup"

  const coverUrl = await loadListingCoverUrl(serviceSupabase, listing.id)

  return {
    ok: true,
    preview: {
      id: listing.id,
      title: listing.title?.trim() || "Untitled listing",
      slug: listing.slug,
      sellerId: listing.user_id,
      status: listing.status,
      itemPrice,
      shippingPrice,
      pickupAvailable,
      shippingAvailable,
      suggestedFulfillment,
      coverUrl,
    },
  }
}

async function resolveAdminTerminalMemberBuyer(
  service: SupabaseClient,
  buyerId: string,
  sellerId: string,
): Promise<
  | {
      ok: true
      buyerId: string
      customerFirstName: string
      customerLastName: string | null
      customerName: string
      customerEmail: string
      customerPhone: string | null
    }
  | { ok: false; error: string; status: number }
> {
  const { data: authData, error: authErr } = await service.auth.admin.getUserById(buyerId)
  if (authErr || !authData.user) {
    return { ok: false, error: "Member account not found", status: 404 }
  }
  if (isAnonymousSupabaseUser(authData.user)) {
    return {
      ok: false,
      error: "This account is a guest session — use walk-in guest checkout or have them sign in with email.",
      status: 400,
    }
  }
  if (authData.user.id === sellerId) {
    return { ok: false, error: "The seller cannot be the buyer for this listing", status: 400 }
  }

  const { data: profile, error: profileErr } = await service
    .from("profiles")
    .select("id, display_name, email, phone")
    .eq("id", buyerId)
    .maybeSingle()

  if (profileErr || !profile) {
    return { ok: false, error: "Member profile not found", status: 404 }
  }

  const customerEmail =
    (await getAuthEmailForUserId(buyerId)) ??
    (typeof profile.email === "string" ? profile.email.trim() : "") ??
    ""
  if (!customerEmail) {
    return { ok: false, error: "Member account has no email on file", status: 400 }
  }

  const customerName =
    (typeof profile.display_name === "string" ? profile.display_name.trim() : "") ||
    customerEmail.split("@")[0] ||
    "Reswell member"
  const nameParts = customerName.split(/\s+/).filter(Boolean)
  const customerFirstName = nameParts[0] ?? "Reswell member"
  const customerLastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : null
  const customerPhone =
    typeof profile.phone === "string" && profile.phone.trim() ? profile.phone.trim() : null

  return {
    ok: true,
    buyerId,
    customerFirstName: customerFirstName.slice(0, 80),
    customerLastName: customerLastName ? customerLastName.slice(0, 80) : null,
    customerName: customerName.slice(0, 500),
    customerEmail: customerEmail.slice(0, 500),
    customerPhone: customerPhone ? customerPhone.slice(0, 500) : null,
  }
}

async function resolveAdminTerminalSaleParties(
  service: SupabaseClient,
  input: Pick<AdminTerminalSaleStartInput, "buyerId" | "customer">,
  sellerId: string,
): Promise<
  | { ok: true; parties: AdminTerminalSaleParties }
  | { ok: false; error: string; status: number }
> {
  if (input.buyerId) {
    const member = await resolveAdminTerminalMemberBuyer(service, input.buyerId, sellerId)
    if (!member.ok) {
      return { ok: false, error: member.error, status: member.status }
    }
    return {
      ok: true,
      parties: {
        customerFirstName: member.customerFirstName,
        customerLastName: member.customerLastName,
        customerName: member.customerName,
        customerEmail: member.customerEmail,
        customerPhone: member.customerPhone,
        linkedBuyerId: member.buyerId,
      },
    }
  }

  const customerFirstName = input.customer!.firstName.trim()
  const customerLastName = input.customer!.lastName?.trim() || null
  const customerName = [customerFirstName, customerLastName].filter(Boolean).join(" ")
  return {
    ok: true,
    parties: {
      customerFirstName,
      customerLastName,
      customerName,
      customerEmail: input.customer!.email.trim(),
      customerPhone: input.customer!.phone?.trim() || null,
    },
  }
}

async function loadListingForAdminTerminalSale(
  service: SupabaseClient,
  listingId: string,
): Promise<
  | { ok: true; listing: AdminTerminalListingRow; totalUsd: number; amountCents: number }
  | { ok: false; error: string; status: number }
> {
  const { data: listingRaw, error: listingErr } = await service
    .from("listings")
    .select(`${PEER_SURFBOARD_CHECKOUT_LISTING_SELECT}, hidden_from_site, archived_at`)
    .eq("id", listingId)
    .maybeSingle()

  if (listingErr || !listingRaw) {
    return { ok: false, error: "Listing not found", status: 404 }
  }

  const listing = listingRaw as AdminTerminalListingRow
  if (listing.archived_at) {
    return { ok: false, error: "Listing is archived", status: 400 }
  }
  if (!["active", "pending_sale"].includes(listing.status)) {
    return { ok: false, error: "Listing is not available for sale", status: 409 }
  }
  if (!isPeerListingSection(listing.section)) {
    return { ok: false, error: "This listing cannot be sold through marketplace checkout", status: 400 }
  }

  const checkoutTotals = await computeAdminTerminalInPersonCheckoutUsd(service, listing)
  if (!checkoutTotals.ok) {
    return { ok: false, error: checkoutTotals.error, status: 422 }
  }

  const { totalUsd } = checkoutTotals.totals
  const amountCents = Math.round(totalUsd * 100)
  if (amountCents < 50) {
    return { ok: false, error: "Amount is below the minimum charge", status: 400 }
  }

  return { ok: true, listing, totalUsd, amountCents }
}

async function createAdminTerminalPaymentIntent(
  adminUserId: string,
  listing: AdminTerminalListingRow,
  amountCents: number,
  parties: AdminTerminalSaleParties,
  paymentMethodTypes: Array<"card" | "card_present">,
): Promise<Stripe.PaymentIntent | null> {
  const stripe = getStripe()
  try {
    return await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "usd",
      payment_method_types: paymentMethodTypes,
      capture_method: "automatic",
      description: `Admin in-person — ${listing.title ?? "listing"}`,
      metadata: {
        sales_channel: ADMIN_TERMINAL_SALES_CHANNEL,
        listing_ids: listing.id,
        listing_id: listing.id,
        fulfillment: ADMIN_TERMINAL_FULFILLMENT,
        amount_cents: String(amountCents),
        bundle_line_count: "1",
        admin_profile_id: adminUserId,
        terminal_customer_name: parties.customerName,
        terminal_customer_first_name: parties.customerFirstName,
        ...(parties.customerLastName ? { terminal_customer_last_name: parties.customerLastName } : {}),
        terminal_customer_email: parties.customerEmail,
        ...(parties.customerPhone ? { terminal_customer_phone: parties.customerPhone } : {}),
        ...(parties.linkedBuyerId ? { buyer_id: parties.linkedBuyerId } : {}),
      },
    })
  } catch (e) {
    console.error("[adminTerminalSale] create payment intent failed", e)
    return null
  }
}

export async function startAdminTerminalSale(
  adminUserId: string,
  input: AdminTerminalSaleStartInput,
): Promise<StartAdminTerminalSaleResult> {
  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    return { ok: false, error: "Stripe is not configured", status: 503 }
  }

  const locationId = getStripeTerminalLocationId()
  if (!locationId) {
    return {
      ok: false,
      error: "Stripe Terminal is not configured. Set STRIPE_TERMINAL_LOCATION_ID.",
      status: 503,
    }
  }

  let service: SupabaseClient
  try {
    service = createServiceRoleClient()
  } catch {
    return { ok: false, error: "Server configuration error", status: 503 }
  }

  const loaded = await loadListingForAdminTerminalSale(service, input.listingId)
  if (!loaded.ok) return loaded

  const { listing, totalUsd, amountCents } = loaded

  const partiesResult = await resolveAdminTerminalSaleParties(service, input, listing.user_id)
  if (!partiesResult.ok) {
    return { ok: false, error: partiesResult.error, status: partiesResult.status }
  }

  const pi = await createAdminTerminalPaymentIntent(
    adminUserId,
    listing,
    amountCents,
    partiesResult.parties,
    ["card_present"],
  )
  if (!pi) {
    return { ok: false, error: "Could not start the payment", status: 502 }
  }

  const listingTitle = listing.title?.trim() || "Reswell listing"

  try {
    await setTerminalReaderCartDisplay(input.readerId, {
      lineItems: [{ description: listingTitle, amountCents, quantity: 1 }],
      totalCents: amountCents,
    })
  } catch (e) {
    console.warn("[adminTerminalSale] set reader cart display failed (continuing)", e)
  }

  try {
    await processPaymentOnReader(input.readerId, pi.id)
  } catch (e) {
    console.error("[adminTerminalSale] process on reader failed", e)
    await cancelReaderAction(input.readerId)
    try {
      await getStripe().paymentIntents.cancel(pi.id)
    } catch {
      // best-effort cleanup
    }
    return {
      ok: false,
      error: "Couldn't reach the card reader. Check that your S710 is online and registered to the Terminal location.",
      status: 502,
    }
  }

  return {
    ok: true,
    paymentIntentId: pi.id,
    readerId: input.readerId,
    amountUsd: totalUsd,
  }
}

export async function startAdminTerminalCardCheckout(
  adminUserId: string,
  input: AdminTerminalSaleCheckoutInput,
): Promise<StartAdminTerminalCardCheckoutResult> {
  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    return { ok: false, error: "Stripe is not configured", status: 503 }
  }

  const keyConfigError = getStripeCheckoutKeyConfigError()
  if (keyConfigError) {
    return { ok: false, error: keyConfigError, status: 503 }
  }

  let service: SupabaseClient
  try {
    service = createServiceRoleClient()
  } catch {
    return { ok: false, error: "Server configuration error", status: 503 }
  }

  const loaded = await loadListingForAdminTerminalSale(service, input.listingId)
  if (!loaded.ok) return loaded

  const { listing, totalUsd, amountCents } = loaded

  const partiesResult = await resolveAdminTerminalSaleParties(service, input, listing.user_id)
  if (!partiesResult.ok) {
    return { ok: false, error: partiesResult.error, status: partiesResult.status }
  }

  const pi = await createAdminTerminalPaymentIntent(
    adminUserId,
    listing,
    amountCents,
    partiesResult.parties,
    ["card"],
  )
  if (!pi?.client_secret) {
    return { ok: false, error: "Could not start card checkout", status: 502 }
  }

  return {
    ok: true,
    paymentIntentId: pi.id,
    clientSecret: pi.client_secret,
    amountUsd: totalUsd,
  }
}

export async function finalizeAdminTerminalSale(
  paymentIntentId: string,
): Promise<FinalizeAdminTerminalSaleResult> {
  const stripe = getStripe()
  let pi: Stripe.PaymentIntent
  try {
    pi = await stripe.paymentIntents.retrieve(paymentIntentId)
  } catch {
    return { ok: false, error: "Payment not found", status: 404 }
  }

  if (pi.metadata?.sales_channel !== ADMIN_TERMINAL_SALES_CHANNEL) {
    return { ok: false, error: "Not an admin terminal payment", status: 400 }
  }

  if (pi.status !== "succeeded") {
    return { ok: false, error: "Payment has not succeeded yet", status: 409 }
  }

  const result = await completeMarketplaceOrderFromPaymentIntent(pi)
  if (!result.ok) {
    return { ok: false, error: result.error, status: result.status }
  }

  return {
    ok: true,
    orderId: result.orderId,
    alreadyProcessed: result.alreadyProcessed,
  }
}

export async function completeAdminTerminalCashSale(
  adminUserId: string,
  input: AdminTerminalSaleCheckoutInput,
): Promise<CompleteAdminTerminalCashSaleResult> {
  let service: SupabaseClient
  try {
    service = createServiceRoleClient()
  } catch {
    return { ok: false, error: "Server configuration error", status: 503 }
  }

  const loaded = await loadListingForAdminTerminalSale(service, input.listingId)
  if (!loaded.ok) return loaded

  const { listing, totalUsd } = loaded
  const checkoutTotals = await computeAdminTerminalInPersonCheckoutUsd(service, listing)
  if (!checkoutTotals.ok) {
    return { ok: false, error: checkoutTotals.error, status: 422 }
  }

  const partiesResult = await resolveAdminTerminalSaleParties(service, input, listing.user_id)
  if (!partiesResult.ok) {
    return { ok: false, error: partiesResult.error, status: partiesResult.status }
  }

  const parties = partiesResult.parties
  const buyerId = parties.linkedBuyerId ?? null
  const { itemPrice, platformFee, sellerEarnings } = checkoutTotals.totals
  const sellerId = listing.user_id

  const orderId = randomUUID()
  const cashReference = `${ADMIN_TERMINAL_CASH_REFERENCE_PREFIX}${orderId}`

  const { data: existing } = await service
    .from("orders")
    .select("id")
    .eq("stripe_checkout_session_id", cashReference)
    .maybeSingle()

  if (existing?.id) {
    return { ok: true, orderId: existing.id, alreadyProcessed: true }
  }

  const shippingAddressJson = buyerId ? null : terminalGuestShippingJson(parties)

  const { data: purchase, error: insertError } = await service
    .from("orders")
    .insert({
      id: orderId,
      listing_id: listing.id,
      buyer_id: buyerId,
      seller_id: sellerId,
      amount: totalUsd,
      shipping_amount: 0,
      platform_fee: platformFee,
      seller_earnings: sellerEarnings,
      promo_code_id: null,
      admin_promo_code_id: null,
      promo_discount_usd: 0,
      status: "confirmed",
      payment_method: "cash",
      stripe_checkout_session_id: cashReference,
      fulfillment_method: ADMIN_TERMINAL_FULFILLMENT,
      delivery_status: "picked_up",
      pickup_code: null,
      sales_channel: ADMIN_TERMINAL_SALES_CHANNEL,
      ...(shippingAddressJson ? { shipping_address: shippingAddressJson } : {}),
    })
    .select()
    .single()

  if (insertError || !purchase) {
    if (isUniqueViolation(insertError)) {
      const { data: raced } = await service
        .from("orders")
        .select("id")
        .eq("stripe_checkout_session_id", cashReference)
        .maybeSingle()
      if (raced?.id) {
        return { ok: true, orderId: raced.id, alreadyProcessed: true }
      }
    }
    console.error("[adminTerminalSale] cash order insert:", insertError)
    return { ok: false, error: "Could not create order", status: 500 }
  }

  const { error: orderItemsErr } = await service.from("order_items").insert({
    order_id: purchase.id,
    listing_id: listing.id,
    sort_order: 0,
    item_price: itemPrice,
    shipping_amount: 0,
    platform_fee: platformFee,
    seller_earnings: sellerEarnings,
  })

  if (orderItemsErr) {
    console.error("[adminTerminalSale] cash order_items insert:", orderItemsErr)
    return { ok: false, error: "Could not create order lines", status: 500 }
  }

  // Cash at register never flows through Stripe or the marketplace wallet ledger — order only.

  const listingTitle = String(listing.title ?? "")

  const { error: listingErr } = await service
    .from("listings")
    .update({ status: "sold" })
    .eq("id", listing.id)

  if (listingErr) {
    console.error("[adminTerminalSale] cash listing update:", listingErr)
    return { ok: false, error: "Could not mark listing sold", status: 500 }
  }

  await safeRevalidateAfterMarketplaceOrderCommit(service, {
    sellerUserId: sellerId,
    listingIds: [listing.id],
    listingSlugs: [listing.slug ?? null],
  })

  void syncListingToGoogleMerchantBestEffort(service, listing.id)
  void markUserListingBoardModelDataSold(service, listing.id, itemPrice)

  if (buyerId) {
    void deleteBuyerCartRowsForListings(service, buyerId, [listing.id])
  }

  void touchUserLastActive(service, sellerId)
  if (buyerId) {
    void touchUserLastActive(service, buyerId)
  }

  const buyerEmail = parties.customerEmail
  const orderNum = formatOrderNumForCustomer(
    (purchase as { order_num?: string | null }).order_num,
    purchase.id,
  )

  if (buyerId) {
    void postPurchaseThreadNotification(service, {
      buyerId,
      sellerId,
      primaryListingId: listing.id,
      listingIds: [listing.id],
      listingTitles: [listingTitle],
      listingTitleSummary: listingTitle,
      orderId: purchase.id,
      orderNum,
      total: totalUsd,
      fulfillment: "pickup",
      shippingAddress: shippingAddressJson,
      paymentMethod: "cash",
    })
  }

  const klaviyoLineItems: KlaviyoBuyerOrderLineItem[] = [
    {
      listingId: listing.id,
      listingTitle,
      listingSection: String(listing.section ?? ""),
      price: itemPrice,
      quantity: 1,
    },
  ]

  await trackKlaviyoBuyerOrderConfirmed({
    buyerUserId: buyerId ?? undefined,
    buyerEmail,
    orderId: purchase.id,
    orderNum: (purchase as { order_num?: string | null }).order_num ?? null,
    listingId: listing.id,
    listingTitle: listingTitle.slice(0, 500),
    listingSection: String(listing.section ?? ""),
    listingSlug: listing.slug ?? null,
    lineItems: klaviyoLineItems,
    amount: totalUsd,
    fulfillmentMethod: "pickup",
    pickupCode: null,
    paymentMethod: "cash",
  })

  await notifySellerOrderCheckoutKlaviyo(service, purchase.id)

  void trackMetaPurchaseServerEvent({
    orderId: purchase.id,
    buyerUserId: buyerId,
    buyerEmail,
    value: totalUsd,
    contentIds: [listing.id],
  })

  if (!buyerId) {
    void syncAdminTerminalGuestToCrm(service, {
      adminProfileId: adminUserId,
      firstName: parties.customerFirstName,
      lastName: parties.customerLastName,
      email: parties.customerEmail,
      phone: parties.customerPhone,
      orderId: purchase.id,
      orderNum: (purchase as { order_num?: string | null }).order_num ?? null,
      listingTitle,
      amountUsd: totalUsd,
    })
  }

  return { ok: true, orderId: purchase.id }
}

export async function cancelAdminTerminalSale(
  paymentIntentId: string,
  readerId?: string,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const stripe = getStripe()
  let pi: Stripe.PaymentIntent
  try {
    pi = await stripe.paymentIntents.retrieve(paymentIntentId)
  } catch {
    return { ok: false, error: "Payment not found", status: 404 }
  }

  if (pi.metadata?.sales_channel !== ADMIN_TERMINAL_SALES_CHANNEL) {
    return { ok: false, error: "Not an admin terminal payment", status: 400 }
  }

  if (readerId?.trim()) {
    await cancelReaderAction(readerId.trim())
  }

  if (pi.status === "succeeded") {
    return { ok: false, error: "Payment already succeeded — refresh to finalize the order.", status: 409 }
  }

  try {
    await stripe.paymentIntents.cancel(paymentIntentId)
  } catch {
    // PI may not be cancelable if already terminal.
  }

  return { ok: true }
}

export function isAdminTerminalPaymentIntent(pi: Stripe.PaymentIntent): boolean {
  return pi.metadata?.sales_channel === ADMIN_TERMINAL_SALES_CHANNEL
}
