/**
 * Server-only: fires the Meta Conversions API Purchase event when an order completes.
 *
 * Uses the deterministic `purchase_{orderId}` event id so it deduplicates against the browser
 * pixel that fires on `/successpage/{orderId}`. Safe to `void` from checkout paths — it never
 * throws and no-ops when CAPI is not configured.
 */

import "server-only"

import { isMetaCapiEnabled, sendMetaServerEvent } from "@/lib/meta/conversions-api"
import { getMetaBrowserSignals } from "@/lib/meta/server-event-context"
import { metaPurchaseEventId } from "@/lib/meta/event-id"
import { publicSiteOrigin } from "@/lib/public-site-origin"

export type MetaPurchaseServerEventInput = {
  orderId: string
  buyerUserId?: string | null
  /**
   * Required for Event Match Quality / purchase attribution. Hashed as `em` before send.
   * Prefer the checkout account email; fall back to PaymentIntent `buyer_email` metadata.
   */
  buyerEmail?: string | null
  buyerPhone?: string | null
  value: number
  currency?: string
  /** Listing UUIDs — aligned with the Meta catalog feed product ids. */
  contentIds: string[]
  numItems?: number
  /**
   * Set ONLY when this runs inside the buyer's own request (e.g. the wallet checkout route or
   * `/successpage`) so `_fbp`/`_fbc`/IP/client_user_agent come from the buyer's browser. Leave
   * false for Stripe webhooks — there the request belongs to Stripe, not the buyer.
   */
  includeBrowserSignals?: boolean
}

export async function trackMetaPurchaseServerEvent(
  input: MetaPurchaseServerEventInput,
): Promise<void> {
  if (!isMetaCapiEnabled()) return

  const orderId = input.orderId?.trim()
  if (!orderId) return

  const value = typeof input.value === "number" ? input.value : Number(input.value)
  if (!Number.isFinite(value) || value <= 0) return

  const buyerEmail = input.buyerEmail?.trim() || null
  if (!buyerEmail && process.env.NODE_ENV === "development") {
    console.warn(
      "[meta-capi] Purchase missing buyerEmail — Meta cannot attribute well without hashed em",
      { orderId },
    )
  }

  // From a Stripe webhook there is no buyer browser context, so we rely on hashed email + external
  // id and the deduped browser Purchase pixel supplies fbp/fbc/IP/UA. On the buyer's own request
  // (wallet checkout / success page) we attach those signals directly via `includeBrowserSignals`.
  const signals = input.includeBrowserSignals ? await getMetaBrowserSignals() : {}

  await sendMetaServerEvent({
    eventName: "Purchase",
    eventId: metaPurchaseEventId(orderId),
    eventSourceUrl: `${publicSiteOrigin()}/successpage/${orderId}`,
    userData: {
      email: buyerEmail,
      phone: input.buyerPhone?.trim() || null,
      externalId: input.buyerUserId ?? null,
      ...signals,
    },
    customData: {
      value,
      currency: input.currency ?? "USD",
      contentIds: input.contentIds,
      contentType: "product",
      orderId,
      numItems: input.numItems ?? (input.contentIds.length || undefined),
    },
  })
}
