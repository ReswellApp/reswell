/**
 * Server-only: fires the Meta Conversions API ViewContent event when a product detail page is
 * viewed.
 *
 * The browser pixel generates `eventId` and POSTs it here (see the view-content API route) so the
 * client ViewContent and this server event share the same `eventID` and Meta deduplicates the
 * pair. Safe to `void` — never throws and no-ops when CAPI is not configured.
 */

import "server-only"

import { isMetaCapiEnabled, sendMetaServerEvent } from "@/lib/meta/conversions-api"
import { getMetaBrowserSignals } from "@/lib/meta/server-event-context"
import { listingDetailHref } from "@/lib/listing-href"
import { publicSiteOrigin } from "@/lib/public-site-origin"

export type MetaViewContentServerEventInput = {
  /** Shared with the browser pixel for deduplication. */
  eventId: string
  listingId: string
  listingSlug?: string | null
  listingSection?: string | null
  value?: number | null
  currency?: string
  /** Real page URL from the browser; falls back to the canonical listing href. */
  eventSourceUrl?: string | null
  viewerUserId?: string | null
  viewerEmail?: string | null
}

export async function trackMetaViewContentServerEvent(
  input: MetaViewContentServerEventInput,
): Promise<void> {
  if (!isMetaCapiEnabled()) return
  if (!input.eventId?.trim() || !input.listingId?.trim()) return

  const signals = await getMetaBrowserSignals()
  const fallbackPath = listingDetailHref({
    id: input.listingId,
    slug: input.listingSlug ?? undefined,
    section: input.listingSection ?? "surfboards",
  })

  await sendMetaServerEvent({
    eventName: "ViewContent",
    eventId: input.eventId,
    eventSourceUrl: input.eventSourceUrl?.trim() || `${publicSiteOrigin()}${fallbackPath}`,
    userData: {
      email: input.viewerEmail ?? null,
      externalId: input.viewerUserId ?? null,
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
