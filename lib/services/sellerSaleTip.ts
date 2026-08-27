import type { SupabaseClient } from "@supabase/supabase-js"
import type Stripe from "stripe"
import { revalidatePath } from "next/cache"
import { revalidateMarketplaceSoldFeedCatalog } from "@/lib/cache/revalidate-marketplace-sold-feed"
import {
  getSellerSaleTipByPaymentIntentId,
  insertSellerSaleTip,
  markSellerSaleTipSucceeded,
} from "@/lib/db/sellerSaleTips"
import { retrieveSucceededPaymentIntent } from "@/lib/stripe-complete-order"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { getStripe, getStripeCheckoutKeyConfigError } from "@/lib/stripe-server"
import {
  SALE_TIP_MAX_CENTS,
  SALE_TIP_MIN_CENTS,
} from "@/lib/validations/mark-listing-sold"

export const SELLER_SALE_TIP_PI_PURPOSE = "seller_sale_tip"

function revalidateAfterSellerSaleTip(): void {
  revalidateMarketplaceSoldFeedCatalog()
  revalidatePath("/sold")
  revalidatePath("/about")
}

export type CreateSellerSaleTipResult =
  | { ok: true; clientSecret: string; amountCents: number }
  | { ok: false; status: number; error: string }

export type CompleteSellerSaleTipResult =
  | { ok: true; alreadyProcessed: boolean }
  | { ok: false; status: number; error: string }

type OwnedSoldListing = {
  id: string
  user_id: string
  status: string
  title: string
}

async function loadOwnedSoldListing(
  supabase: SupabaseClient,
  listingId: string,
  sellerUserId: string,
): Promise<OwnedSoldListing | null> {
  const { data, error } = await supabase
    .from("listings")
    .select("id, user_id, status, title")
    .eq("id", listingId)
    .maybeSingle()

  if (error || !data) return null
  const row = data as OwnedSoldListing
  if (row.user_id !== sellerUserId) return null
  return row
}

export async function createSellerSaleTipPaymentIntent(
  supabase: SupabaseClient,
  params: {
    listingId: string
    sellerUserId: string
    sellerEmail?: string | null
    amountCents: number
  },
): Promise<CreateSellerSaleTipResult> {
  const keyConfigError = getStripeCheckoutKeyConfigError()
  if (keyConfigError) {
    return { ok: false, status: 503, error: keyConfigError }
  }

  if (
    !Number.isInteger(params.amountCents) ||
    params.amountCents < SALE_TIP_MIN_CENTS ||
    params.amountCents > SALE_TIP_MAX_CENTS
  ) {
    return { ok: false, status: 400, error: "Invalid tip amount" }
  }

  const listing = await loadOwnedSoldListing(supabase, params.listingId, params.sellerUserId)
  if (!listing) {
    return { ok: false, status: 404, error: "Not found" }
  }
  if (
    listing.status !== "sold" &&
    listing.status !== "active" &&
    listing.status !== "pending_sale"
  ) {
    return { ok: false, status: 400, error: "Listing cannot accept a tip" }
  }

  let service: SupabaseClient
  try {
    service = createServiceRoleClient()
  } catch {
    return { ok: false, status: 503, error: "Could not start tip payment" }
  }

  try {
    const stripe = getStripe()
    const paymentIntent = await stripe.paymentIntents.create({
      amount: params.amountCents,
      currency: "usd",
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      receipt_email: params.sellerEmail?.trim() || undefined,
      metadata: {
        purpose: SELLER_SALE_TIP_PI_PURPOSE,
        listing_id: params.listingId,
        seller_id: params.sellerUserId,
        amount_cents: String(params.amountCents),
      },
      description: `Reswell tip — ${listing.title}`.slice(0, 1000),
    })

    if (!paymentIntent.client_secret) {
      return { ok: false, status: 500, error: "Could not start tip payment" }
    }

    const inserted = await insertSellerSaleTip(service, {
      listingId: params.listingId,
      sellerUserId: params.sellerUserId,
      amountCents: params.amountCents,
      stripePaymentIntentId: paymentIntent.id,
    })
    if (!inserted) {
      await stripe.paymentIntents.cancel(paymentIntent.id).catch(() => undefined)
      return { ok: false, status: 500, error: "Could not start tip payment" }
    }

    return {
      ok: true,
      clientSecret: paymentIntent.client_secret,
      amountCents: params.amountCents,
    }
  } catch (e) {
    console.error("[createSellerSaleTipPaymentIntent] Stripe:", e)
    return { ok: false, status: 502, error: "Could not create payment" }
  }
}

export function isSellerSaleTipPaymentIntent(pi: Stripe.PaymentIntent): boolean {
  return pi.metadata?.purpose === SELLER_SALE_TIP_PI_PURPOSE
}

export async function completeSellerSaleTipFromPaymentIntent(params: {
  supabase: SupabaseClient
  paymentIntent: Stripe.PaymentIntent
}): Promise<CompleteSellerSaleTipResult> {
  const { supabase, paymentIntent: pi } = params
  if (!isSellerSaleTipPaymentIntent(pi)) {
    return { ok: false, status: 400, error: "Not a sale tip payment" }
  }
  if (pi.status !== "succeeded") {
    return { ok: false, status: 400, error: "Payment has not succeeded" }
  }

  const existing = await getSellerSaleTipByPaymentIntentId(supabase, pi.id)
  if (!existing) {
    return { ok: false, status: 404, error: "Tip record not found" }
  }
  if (existing.status === "succeeded") {
    revalidateAfterSellerSaleTip()
    return { ok: true, alreadyProcessed: true }
  }

  const marked = await markSellerSaleTipSucceeded(supabase, pi.id)
  if (!marked) {
    return { ok: false, status: 500, error: "Failed to record tip" }
  }
  revalidateAfterSellerSaleTip()
  return { ok: true, alreadyProcessed: false }
}

export async function finalizeSellerSaleTipPayment(params: {
  listingId: string
  sellerUserId: string
  paymentIntentId: string
}): Promise<CompleteSellerSaleTipResult> {
  const retrieved = await retrieveSucceededPaymentIntent(params.paymentIntentId)
  if (!retrieved.ok) return retrieved

  const pi = retrieved.paymentIntent
  if (!isSellerSaleTipPaymentIntent(pi)) {
    return { ok: false, status: 400, error: "Not a sale tip payment" }
  }
  if (pi.metadata?.listing_id !== params.listingId) {
    return { ok: false, status: 403, error: "Invalid payment" }
  }
  if (pi.metadata?.seller_id !== params.sellerUserId) {
    return { ok: false, status: 403, error: "Invalid payment" }
  }

  let service: SupabaseClient
  try {
    service = createServiceRoleClient()
  } catch {
    return { ok: false, status: 503, error: "Could not complete tip" }
  }

  return completeSellerSaleTipFromPaymentIntent({
    supabase: service,
    paymentIntent: pi,
  })
}
