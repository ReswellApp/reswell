/**
 * Server-only: Klaviyo Events API for consignors (the person who dropped a board at a shop).
 *
 * Metric names (use as Flow triggers):
 *   - `Consignment Approved` — board went live. Vars: {{ event.Title }}, {{ event.store_name }},
 *     {{ event.asking_price }}, {{ event.listing_url }}
 *   - `Consignment Rejected` — shop declined the board. Vars: {{ event.Title }}, {{ event.store_name }}
 *   - `Consignment Sold` — board sold. Vars: {{ event.Title }}, {{ event.store_name }},
 *     {{ event.payout }}, {{ event.earnings_url }}
 *
 * All best-effort: a missing email or Klaviyo error never blocks the underlying mutation.
 */

import { publicSiteOrigin } from "@/lib/public-site-origin"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import { getAuthEmailForUserId } from "@/lib/klaviyo/auth-user-email"

type ConsignorEventBase = {
  consignorProfileId: string
  storeName: string
  listingTitle: string
}

export async function trackConsignmentApproved(
  payload: ConsignorEventBase & { listingSlug: string | null; askingPriceUsd: number },
): Promise<void> {
  const email = await getAuthEmailForUserId(payload.consignorProfileId)
  if (!email) return

  const origin = publicSiteOrigin()
  await sendKlaviyoServerEvent({
    metricName: "Consignment Approved",
    profile: { email },
    properties: {
      Title: payload.listingTitle,
      store_name: payload.storeName,
      asking_price: payload.askingPriceUsd,
      listing_url: payload.listingSlug ? `${origin}/listings/${payload.listingSlug}` : origin,
    },
  })
}

export async function trackConsignmentRejected(payload: ConsignorEventBase): Promise<void> {
  const email = await getAuthEmailForUserId(payload.consignorProfileId)
  if (!email) return

  await sendKlaviyoServerEvent({
    metricName: "Consignment Rejected",
    profile: { email },
    properties: {
      Title: payload.listingTitle,
      store_name: payload.storeName,
    },
  })
}

export async function trackConsignmentSold(
  payload: ConsignorEventBase & { orderId: string; consignorEarningsUsd: number },
): Promise<void> {
  const email = await getAuthEmailForUserId(payload.consignorProfileId)
  if (!email) return

  const origin = publicSiteOrigin()
  await sendKlaviyoServerEvent({
    metricName: "Consignment Sold",
    profile: { email },
    uniqueId: `consignment-sold-${payload.orderId}`,
    value: Number.isFinite(payload.consignorEarningsUsd) ? payload.consignorEarningsUsd : undefined,
    valueCurrency: "USD",
    properties: {
      order_id: payload.orderId,
      Title: payload.listingTitle,
      store_name: payload.storeName,
      payout: payload.consignorEarningsUsd,
      earnings_url: `${origin}/dashboard/earnings`,
    },
  })
}
