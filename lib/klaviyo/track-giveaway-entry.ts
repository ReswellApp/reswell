/**
 * Server-only: Klaviyo Events API for giveaway raffle entries.
 *
 * Metrics: `Giveaway Entered` and `Giveaway Qualified`.
 */

import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import type { GiveawayEntry, GiveawayPrizeBrandId } from "@/lib/types/giveaways"

export async function trackKlaviyoGiveawayEntered(params: {
  userId: string
  userEmail?: string | null
  giveawaySlug: string
  preferredBrand: GiveawayPrizeBrandId | null
  status: GiveawayEntry["status"]
}): Promise<void> {
  await sendKlaviyoServerEvent({
    metricName: "Giveaway Entered",
    uniqueId: `giveaway-entered-${params.userId}-${params.giveawaySlug}`,
    profile: {
      external_id: params.userId,
      email: params.userEmail,
    },
    properties: {
      giveaway_slug: params.giveawaySlug,
      preferred_brand: params.preferredBrand,
      status: params.status,
    },
  })
}

export async function trackKlaviyoGiveawayQualified(params: {
  userId: string
  userEmail?: string | null
  giveawaySlug: string
  listingId: string
  preferredBrand: GiveawayPrizeBrandId | null
}): Promise<void> {
  await sendKlaviyoServerEvent({
    metricName: "Giveaway Qualified",
    uniqueId: `giveaway-qualified-${params.userId}-${params.giveawaySlug}`,
    profile: {
      external_id: params.userId,
      email: params.userEmail,
    },
    properties: {
      giveaway_slug: params.giveawaySlug,
      preferred_brand: params.preferredBrand,
      listing_id: params.listingId,
    },
  })
}
