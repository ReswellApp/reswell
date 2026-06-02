/**
 * Server-only: fires the Meta Conversions API Purchase event when an order completes.
 *
 * Uses the deterministic `purchase_{orderId}` event id so it deduplicates against the browser
 * pixel that fires on `/successpage/{orderId}`. Safe to `void` from checkout paths — it never
 * throws and no-ops when CAPI is not configured.
 */

import "server-only"

import { isMetaCapiEnabled, sendMetaServerEvent } from "@/lib/meta/conversions-api"
import { metaPurchaseEventId } from "@/lib/meta/event-id"
import { publicSiteOrigin } from "@/lib/public-site-origin"

export type MetaPurchaseServerEventInput = {
  orderId: string
  buyerUserId?: string | null
  buyerEmail?: string | null
  value: number
  currency?: string
  /** Listing UUIDs — aligned with the Meta catalog feed product ids. */
  contentIds: string[]
  numItems?: number
}

export async function trackMetaPurchaseServerEvent(
  input: MetaPurchaseServerEventInput,
): Promise<void> {
  if (!isMetaCapiEnabled()) return

  const orderId = input.orderId?.trim()
  if (!orderId) return

  const value = typeof input.value === "number" ? input.value : Number(input.value)
  if (!Number.isFinite(value) || value <= 0) return

  // Order completion can run from a Stripe webhook (no buyer browser context), so we rely on the
  // hashed email + external id here. The deduped browser Purchase pixel supplies fbp/fbc/IP/UA.
  await sendMetaServerEvent({
    eventName: "Purchase",
    eventId: metaPurchaseEventId(orderId),
    eventSourceUrl: `${publicSiteOrigin()}/successpage/${orderId}`,
    userData: {
      email: input.buyerEmail ?? null,
      externalId: input.buyerUserId ?? null,
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
