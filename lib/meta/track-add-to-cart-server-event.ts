/**
 * Server-only: fires the Meta Conversions API AddToCart event when an item is added to cart.
 *
 * The caller generates `eventId` and returns it to the browser so the client pixel fires the
 * matching AddToCart with the same `eventID` (dedup). Safe to `void` — never throws and
 * no-ops when CAPI is not configured.
 */

import "server-only"

import { isMetaCapiEnabled, sendMetaServerEvent } from "@/lib/meta/conversions-api"
import { getMetaBrowserSignals } from "@/lib/meta/server-event-context"
import type { MetaBrowserSignalsOverride } from "@/lib/meta/resolve-browser-signals"
import { listingDetailHref } from "@/lib/listing-href"
import { publicSiteOrigin } from "@/lib/public-site-origin"

export type MetaAddToCartServerEventInput = {
  /** Shared with the browser pixel for deduplication. */
  eventId: string
  listingId: string
  listingSlug?: string | null
  listingSection?: string | null
  value?: number | null
  currency?: string
  buyerUserId?: string | null
  buyerEmail?: string | null
  /** From the client Parameter Builder — keeps server `fbc`/`fbp` aligned with the browser pixel. */
  browserSignals?: MetaBrowserSignalsOverride
}

export async function trackMetaAddToCartServerEvent(
  input: MetaAddToCartServerEventInput,
): Promise<void> {
  if (!isMetaCapiEnabled()) return
  if (!input.eventId?.trim() || !input.listingId?.trim()) return

  const signals = await getMetaBrowserSignals(input.browserSignals)
  const path = listingDetailHref({
    id: input.listingId,
    slug: input.listingSlug ?? undefined,
    section: input.listingSection ?? "surfboards",
  })

  await sendMetaServerEvent({
    eventName: "AddToCart",
    eventId: input.eventId,
    eventSourceUrl: `${publicSiteOrigin()}${path}`,
    userData: {
      email: input.buyerEmail ?? null,
      externalId: input.buyerUserId ?? null,
      ...signals,
    },
    customData: {
      value: input.value ?? undefined,
      currency: input.currency ?? "USD",
      contentIds: [input.listingId],
      contentType: "product",
    },
  })
}
