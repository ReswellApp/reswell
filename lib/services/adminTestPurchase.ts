import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchSellerFeeWaived } from "@/lib/db/profileSellerFee"
import { ADMIN_TEST_ORDER_STRIPE_PREFIX } from "@/lib/order-admin-test"
import { generatePickupCode } from "@/lib/order-status"
import { resolvePayableAmount } from "@/lib/purchase-amount"
import { getSellerEarnings } from "@/lib/seller-fees"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type ListingRef = { kind: "id" | "slug"; value: string }

type TestPurchaseListingRow = {
  id: string
  title: string | null
  slug: string | null
  user_id: string
  price: string | number
  section: string
  status: string
  shipping_available: boolean | null
  local_pickup: boolean | null
  shipping_price: string | number | null
  hidden_from_site: boolean | null
}

export type AdminTestPurchaseListingPreview = {
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
}

export type CreateAdminTestPurchaseInput = {
  buyerId: string
  buyerEmail: string | null
  listingRef: string
  fulfillment?: "pickup" | "shipping"
}

export type CreateAdminTestPurchaseResult =
  | {
      ok: true
      orderId: string
      successPagePath: string
      amount: number
      fulfillmentMethod: "pickup" | "shipping"
    }
  | { ok: false; error: string; status: number }

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

async function loadListingForTestPurchase(
  serviceSupabase: SupabaseClient,
  listingRef: string,
): Promise<{ ok: true; listing: TestPurchaseListingRow } | { ok: false; error: string; status: number }> {
  const ref = extractListingRefFromInput(listingRef)
  if (!ref.value) {
    return { ok: false, error: "Enter a listing UUID, slug, or gear URL", status: 400 }
  }

  let query = serviceSupabase
    .from("listings")
    .select(
      "id, title, slug, user_id, price, section, status, shipping_available, local_pickup, shipping_price, hidden_from_site",
    )
    .limit(1)

  query = ref.kind === "id" ? query.eq("id", ref.value) : query.eq("slug", ref.value)

  const { data, error } = await query.maybeSingle()
  if (error) {
    console.error("[adminTestPurchase] listing lookup:", error.message)
    return { ok: false, error: "Could not load listing", status: 500 }
  }
  if (!data) {
    return { ok: false, error: "Listing not found", status: 404 }
  }

  const listing = data as TestPurchaseListingRow
  if (listing.hidden_from_site) {
    return { ok: false, error: "Listing is hidden from site", status: 400 }
  }
  if (!["active", "pending_sale"].includes(listing.status)) {
    return {
      ok: false,
      error: `Listing status is "${listing.status}" — use an active or pending_sale listing`,
      status: 400,
    }
  }

  return { ok: true, listing }
}

function resolveFulfillment(
  listing: TestPurchaseListingRow,
  requested?: "pickup" | "shipping",
): { ok: true; fulfillment: "pickup" | "shipping" } | { ok: false; error: string } {
  const pickupAvailable = listing.local_pickup !== false
  const shippingAvailable = Boolean(listing.shipping_available)

  if (pickupAvailable && !shippingAvailable) {
    return { ok: true, fulfillment: "pickup" }
  }
  if (!pickupAvailable && shippingAvailable) {
    return { ok: true, fulfillment: "shipping" }
  }
  if (pickupAvailable && shippingAvailable) {
    if (!requested) {
      return { ok: false, error: "Choose pickup or shipping for this listing" }
    }
    return { ok: true, fulfillment: requested }
  }

  return { ok: false, error: "Listing has no valid fulfillment options" }
}

function testShippingAddress(buyerEmail: string | null) {
  return {
    name: "Test Buyer",
    email: buyerEmail?.trim() || "test-buyer@reswell.app",
    phone: "555-0100",
    address: {
      line1: "123 Test Street",
      line2: null,
      city: "Austin",
      state: "TX",
      postal_code: "78701",
      country: "US",
    },
  }
}

export async function previewAdminTestPurchaseListing(
  serviceSupabase: SupabaseClient,
  listingRef: string,
): Promise<
  | { ok: true; preview: AdminTestPurchaseListingPreview }
  | { ok: false; error: string; status: number }
> {
  const loaded = await loadListingForTestPurchase(serviceSupabase, listingRef)
  if (!loaded.ok) return loaded

  const { listing } = loaded
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
    },
  }
}

export async function createAdminTestPurchase(
  serviceSupabase: SupabaseClient,
  input: CreateAdminTestPurchaseInput,
): Promise<CreateAdminTestPurchaseResult> {
  const buyerId = input.buyerId.trim()
  if (!buyerId) {
    return { ok: false, error: "Missing buyer", status: 400 }
  }

  const loaded = await loadListingForTestPurchase(serviceSupabase, input.listingRef)
  if (!loaded.ok) return loaded

  const { listing } = loaded
  if (listing.user_id === buyerId) {
    return { ok: false, error: "You cannot purchase your own listing", status: 400 }
  }

  const fulfillmentResult = resolveFulfillment(listing, input.fulfillment)
  if (!fulfillmentResult.ok) {
    return { ok: false, error: fulfillmentResult.error, status: 400 }
  }

  const fulfillment = fulfillmentResult.fulfillment
  const resolved = resolvePayableAmount(listing, fulfillment)
  if (!resolved.ok) {
    return { ok: false, error: resolved.error, status: 400 }
  }

  const feeWaived = await fetchSellerFeeWaived(listing.user_id)
  const { marketplaceFee: platformFee, sellerEarnings } = getSellerEarnings(resolved.itemPrice, {
    feeWaived,
  })

  const isPickup = fulfillment === "pickup"
  const orderId = randomUUID()
  const stripeReference = `${ADMIN_TEST_ORDER_STRIPE_PREFIX}${randomUUID()}`

  const { error: insertErr } = await serviceSupabase.from("orders").insert({
    id: orderId,
    listing_id: listing.id,
    buyer_id: buyerId,
    seller_id: listing.user_id,
    amount: resolved.total,
    shipping_amount: resolved.shipping,
    platform_fee: platformFee,
    seller_earnings: sellerEarnings,
    status: "confirmed",
    is_admin_test: true,
    payment_method: "stripe",
    stripe_checkout_session_id: stripeReference,
    fulfillment_method: fulfillment,
    delivery_status: isPickup ? "pickup_ready" : "pending",
    pickup_code: isPickup ? generatePickupCode() : null,
    shipping_address: isPickup ? null : testShippingAddress(input.buyerEmail),
  })

  if (insertErr) {
    console.error("[adminTestPurchase] order insert:", insertErr.message)
    return { ok: false, error: "Could not create test order", status: 500 }
  }

  return {
    ok: true,
    orderId,
    successPagePath: `/successpage/${orderId}`,
    amount: resolved.total,
    fulfillmentMethod: fulfillment,
  }
}
