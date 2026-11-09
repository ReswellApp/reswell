import type { SupabaseClient } from "@supabase/supabase-js"
import type Stripe from "stripe"

import {
  dbCaptureCheckoutSessionStock,
  dbExpireOpenCheckoutSession,
  dbExpireStaleCheckoutSessions,
  dbFindCheckoutSessionById,
  dbFindOpenCheckoutSession,
  dbFindRecentPaidCheckoutSession,
  dbInsertCheckoutSession,
  dbListExpirableOpenCheckoutSessions,
  dbListOpenCheckoutSessionsForBuyer,
  dbMarkCheckoutSessionPaid,
  dbReplaceCheckoutSessionItems,
  dbReserveCheckoutSessionStock,
  dbUpdateCheckoutSession,
  isMissingCheckoutSessionsRelation,
  type CheckoutSessionRow,
} from "@/lib/db/checkoutSessions"
import { peerBrandNewStockQuantity } from "@/lib/listing-stock-quantity"
import { isReswellShopListing } from "@/lib/reswell-shop"
import { isShopifyManagedListing } from "@/lib/shopify/listing"
import { ALREADY_PURCHASED_CHECKOUT_CODE } from "@/lib/stripe/checkout-payment-recovery"
import {
  CHECKOUT_SESSION_TTL_MS,
  checkoutListingSetsOverlap,
  checkoutSessionFingerprint,
} from "@/lib/stripe/checkout-session-fingerprint"

const PI_REUSABLE_STATUSES = new Set([
  "requires_payment_method",
  "requires_confirmation",
  "requires_action",
])

export type CheckoutSessionListing = {
  id: string
  section?: string | null
  condition?: string | null
  stock_quantity?: number | null
  inventory_source?: string | null
}

export function listingIsUniqueCheckoutItem(listing: CheckoutSessionListing): boolean {
  if (isShopifyManagedListing(listing)) return true
  if (isReswellShopListing(listing.section)) return false
  return peerBrandNewStockQuantity(listing) < 1
}

function expiresAtIso(nowMs = Date.now()): string {
  return new Date(nowMs + CHECKOUT_SESSION_TTL_MS).toISOString()
}

export type BindCheckoutSessionResult =
  | {
      ok: true
      paymentIntent: Stripe.PaymentIntent
      sessionId: string
      alreadyPaid?: boolean
      orderId?: string
    }
  | {
      ok: false
      error: string
      status: number
      code?: string
      orderId?: string
      missingTable?: boolean
    }

function sessionItemsFromListings(
  listingIds: string[],
  quantities: Record<string, number>,
  listings: CheckoutSessionListing[],
): Array<{ listingId: string; quantity: number; uniqueItem: boolean }> {
  const byId = new Map(listings.map((listing) => [listing.id, listing]))
  return listingIds.map((id) => {
    const listing = byId.get(id)
    return {
      listingId: id,
      quantity: Math.max(1, Math.floor(Number(quantities[id]) || 1)),
      uniqueItem: listing ? listingIsUniqueCheckoutItem(listing) : true,
    }
  })
}

async function attachItemsAndReserve(input: {
  supabase: SupabaseClient
  sessionId: string
  listingIds: string[]
  quantities: Record<string, number>
  listings: CheckoutSessionListing[]
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const items = sessionItemsFromListings(input.listingIds, input.quantities, input.listings)
  const replaced = await dbReplaceCheckoutSessionItems(input.supabase, input.sessionId, items)
  if (!replaced.ok) {
    return { ok: false, error: "Could not start checkout", status: 500 }
  }
  const reserved = await dbReserveCheckoutSessionStock(input.supabase, input.sessionId)
  if (!reserved.ok) {
    return {
      ok: false,
      error: reserved.error,
      status: reserved.error.includes("no longer available") ? 409 : 500,
    }
  }
  return { ok: true }
}

async function createBoundPaymentIntent(input: {
  stripe: Stripe
  sessionId: string
  params: Stripe.PaymentIntentCreateParams
}): Promise<Stripe.PaymentIntent> {
  const metadata = {
    ...(input.params.metadata ?? {}),
    checkout_session_id: input.sessionId,
  }
  return input.stripe.paymentIntents.create(
    { ...input.params, metadata },
    { idempotencyKey: `checkout_session_${input.sessionId}` },
  )
}

async function cancelReusablePaymentIntent(
  stripe: Stripe,
  paymentIntentId: string | null | undefined,
): Promise<void> {
  const id = paymentIntentId?.trim()
  if (!id) return
  try {
    const existing = await stripe.paymentIntents.retrieve(id)
    if (!PI_REUSABLE_STATUSES.has(existing.status)) return
    await stripe.paymentIntents.cancel(existing.id)
  } catch (error) {
    console.warn("[checkout-session] cancel PI:", error)
  }
}

async function expireOpenSessionWithPaymentIntent(input: {
  supabase: SupabaseClient
  stripe: Stripe
  sessionId: string
  paymentIntentId: string | null
}): Promise<void> {
  await cancelReusablePaymentIntent(input.stripe, input.paymentIntentId)
  await dbExpireOpenCheckoutSession(input.supabase, input.sessionId)
}

async function expireOverlappingOpenSessions(input: {
  supabase: SupabaseClient
  stripe: Stripe
  buyerId: string
  listingIds: string[]
  keepSessionId: string
}): Promise<void> {
  const overlapping = await dbListOpenCheckoutSessionsForBuyer(input.supabase, input.buyerId)
  for (const row of overlapping) {
    if (row.id === input.keepSessionId) continue
    if (!checkoutListingSetsOverlap(row.listing_ids ?? [], input.listingIds)) continue
    await expireOpenSessionWithPaymentIntent({
      supabase: input.supabase,
      stripe: input.stripe,
      sessionId: row.id,
      paymentIntentId: row.stripe_payment_intent_id,
    })
  }
}

export async function bindCheckoutSessionPaymentIntent(input: {
  supabase: SupabaseClient
  stripe: Stripe
  buyerId: string
  listingIds: string[]
  quantities: Record<string, number>
  listings: CheckoutSessionListing[]
  amountCents: number
  fulfillment: string
  addressId: string | null
  promoCodeId: string | null
  offerId: string | null
  resumeSessionId?: string | null
  forceNewSession?: boolean
  createParams: Stripe.PaymentIntentCreateParams
}): Promise<BindCheckoutSessionResult> {
  const expiredOpen = await dbListExpirableOpenCheckoutSessions(input.supabase)
  for (const row of expiredOpen) {
    await cancelReusablePaymentIntent(input.stripe, row.stripe_payment_intent_id)
  }
  await dbExpireStaleCheckoutSessions(input.supabase)

  const fingerprint = checkoutSessionFingerprint({
    listingIds: input.listingIds,
    quantities: input.quantities,
    offerId: input.offerId,
  })

  let resume = input.resumeSessionId?.trim()
    ? await dbFindCheckoutSessionById(input.supabase, input.resumeSessionId.trim(), input.buyerId)
    : null
  if (resume && resume.fingerprint !== fingerprint && resume.status === "open") {
    resume = null
  }

  const openLookup = await dbFindOpenCheckoutSession(
    input.supabase,
    input.buyerId,
    fingerprint,
  )
  if (openLookup.missingTable) {
    return {
      ok: false,
      error: "checkout_sessions missing",
      status: 501,
      missingTable: true,
    }
  }

  const paid = await dbFindRecentPaidCheckoutSession(
    input.supabase,
    input.buyerId,
    fingerprint,
  )
  if (paid?.order_id && !input.forceNewSession) {
    return {
      ok: false,
      error: "You already purchased this item. Open your order instead of paying again.",
      status: 409,
      code: ALREADY_PURCHASED_CHECKOUT_CODE,
      orderId: paid.order_id,
    }
  }
  if (
    paid?.stripe_payment_intent_id &&
    !paid.order_id &&
    !input.forceNewSession
  ) {
    try {
      const pi = await input.stripe.paymentIntents.retrieve(paid.stripe_payment_intent_id)
      if (pi.status === "succeeded" || pi.status === "processing") {
        return {
          ok: true,
          paymentIntent: pi,
          sessionId: paid.id,
          alreadyPaid: true,
        }
      }
    } catch (error) {
      console.error("[checkout-session] retrieve paid PI:", error)
    }
  }

  let session: CheckoutSessionRow | null = resume?.status === "open" ? resume : openLookup.session

  if (input.forceNewSession && session) {
    await expireOpenSessionWithPaymentIntent({
      supabase: input.supabase,
      stripe: input.stripe,
      sessionId: session.id,
      paymentIntentId: session.stripe_payment_intent_id,
    })
    session = null
  }

  if (session?.stripe_payment_intent_id) {
    try {
      const existing = await input.stripe.paymentIntents.retrieve(session.stripe_payment_intent_id)
      if (existing.status === "succeeded" || existing.status === "processing") {
        return {
          ok: true,
          paymentIntent: existing,
          sessionId: session.id,
          alreadyPaid: true,
          ...(session.order_id ? { orderId: session.order_id } : {}),
        }
      }
      if (PI_REUSABLE_STATUSES.has(existing.status)) {
        const metadata = {
          ...(existing.metadata ?? {}),
          ...(input.createParams.metadata ?? {}),
          checkout_session_id: session.id,
        }
        const updated =
          existing.amount !== input.amountCents ||
          existing.description !== input.createParams.description
            ? await input.stripe.paymentIntents.update(existing.id, {
                amount: input.amountCents,
                metadata,
                ...(input.createParams.description
                  ? { description: input.createParams.description }
                  : {}),
              })
            : existing
        await dbUpdateCheckoutSession(input.supabase, session.id, {
          amount_cents: input.amountCents,
          expires_at: expiresAtIso(),
          address_id: input.addressId,
          fulfillment: input.fulfillment,
          promo_code_id: input.promoCodeId,
        })
        await expireOverlappingOpenSessions({
          supabase: input.supabase,
          stripe: input.stripe,
          buyerId: input.buyerId,
          listingIds: input.listingIds,
          keepSessionId: session.id,
        })
        const reserved = await attachItemsAndReserve({
          supabase: input.supabase,
          sessionId: session.id,
          listingIds: input.listingIds,
          quantities: input.quantities,
          listings: input.listings,
        })
        if (!reserved.ok) return reserved
        return { ok: true, paymentIntent: updated, sessionId: session.id }
      }
      await expireOpenSessionWithPaymentIntent({
        supabase: input.supabase,
        stripe: input.stripe,
        sessionId: session.id,
        paymentIntentId: existing.id,
      })
      session = null
    } catch (error) {
      console.error("[checkout-session] resume PI:", error)
    }
  }

  if (!session) {
    const inserted = await dbInsertCheckoutSession(input.supabase, {
      buyerId: input.buyerId,
      fingerprint,
      listingIds: input.listingIds,
      quantities: input.quantities,
      amountCents: input.amountCents,
      fulfillment: input.fulfillment,
      addressId: input.addressId,
      promoCodeId: input.promoCodeId,
      expiresAtIso: expiresAtIso(),
    })
    if (inserted.missingTable) {
      return {
        ok: false,
        error: "checkout_sessions missing",
        status: 501,
        missingTable: true,
      }
    }
    if (!inserted.session) {
      const raced = await dbFindOpenCheckoutSession(input.supabase, input.buyerId, fingerprint)
      session = raced.session
      if (!session) {
        return {
          ok: false,
          error: inserted.error ?? "Could not start checkout",
          status: 500,
        }
      }
    } else {
      session = inserted.session
    }
  }

  await expireOverlappingOpenSessions({
    supabase: input.supabase,
    stripe: input.stripe,
    buyerId: input.buyerId,
    listingIds: input.listingIds,
    keepSessionId: session.id,
  })

  const reserved = await attachItemsAndReserve({
    supabase: input.supabase,
    sessionId: session.id,
    listingIds: input.listingIds,
    quantities: input.quantities,
    listings: input.listings,
  })
  if (!reserved.ok) return reserved

  const paymentIntent = await createBoundPaymentIntent({
    stripe: input.stripe,
    sessionId: session.id,
    params: input.createParams,
  })
  await dbUpdateCheckoutSession(input.supabase, session.id, {
    stripe_payment_intent_id: paymentIntent.id,
    amount_cents: input.amountCents,
    expires_at: expiresAtIso(),
  })

  if (paymentIntent.status === "succeeded" || paymentIntent.status === "processing") {
    return {
      ok: true,
      paymentIntent,
      sessionId: session.id,
      alreadyPaid: true,
    }
  }

  return { ok: true, paymentIntent, sessionId: session.id }
}

export async function completeCheckoutSessionForPaymentIntent(
  supabase: SupabaseClient,
  paymentIntent: Stripe.PaymentIntent,
  orderId: string,
): Promise<{ capturedStock: boolean }> {
  const sessionId = paymentIntent.metadata?.checkout_session_id?.trim() || ""
  const piId = paymentIntent.id
  let capturedStock = false

  if (sessionId) {
    const captured = await dbCaptureCheckoutSessionStock(supabase, sessionId)
    capturedStock = captured.ok
    if (!captured.ok) {
      console.error("[checkout-session] capture stock:", captured.error)
    }
  }

  await dbMarkCheckoutSessionPaid(supabase, piId, orderId, sessionId || null)
  return { capturedStock }
}

export { isMissingCheckoutSessionsRelation }
