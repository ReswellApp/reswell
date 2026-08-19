/**
 * Server-only: Klaviyo Events API for the list-a-board raffle.
 *
 * **Giveaway Entered** — confirmation that they signed up. Build a flow:
 * 1. Flows → Create flow → Metric → **Giveaway Entered**.
 * 2. Trigger filter: `reswell_metric_seed` is not true.
 * 3. Send immediately. Split on `qualified`:
 *    - Yes → “You’re in the raffle.”
 *    - No → “List a surfboard to complete your entry.” CTA: `{{ event.List_URL }}`.
 *
 * **Giveaway Listing Reminder** — cron/admin for pending entries with no listing.
 * 1. Metric → **Giveaway Listing Reminder**.
 * 2. Filter `reswell_metric_seed` is not true.
 * 3. Conditional split: profile has done **Giveaway Qualified** or **Listing**
 *    since this flow started → Yes → exit. No → send “Finish listing your board”.
 * 4. CTA: `{{ event.List_URL }}`.
 *
 * **Giveaway Qualified** — they published a surfboard; listing is their ticket.
 *
 * Cron: `GET /api/cron/klaviyo-giveaway-listing-reminders`
 * Admin send: `POST /api/admin/giveaways/listing-reminders/run`
 * Bootstrap: `POST /api/integrations/klaviyo/bootstrap-giveaway-metrics`
 */

import { getAuthEmailForUserId } from "@/lib/klaviyo/auth-user-email"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import {
  formatGiveawayEndDate,
  getGiveawayBySlug,
  getGiveawayPrizeBrand,
} from "@/lib/giveaways/catalog"
import { GIVEAWAYS_INDEX_HREF, giveawaySellHref } from "@/lib/giveaways/paths"
import { publicSiteOriginForEmail } from "@/lib/public-site-origin"
import type { GiveawayEntry, GiveawayPrizeBrandId } from "@/lib/types/giveaways"

export const GIVEAWAY_ENTERED_METRIC = "Giveaway Entered"
export const GIVEAWAY_QUALIFIED_METRIC = "Giveaway Qualified"
export const GIVEAWAY_LISTING_REMINDER_METRIC = "Giveaway Listing Reminder"

type GiveawayKlaviyoProfile = {
  userId: string
  userEmail?: string | null
}

async function resolveGiveawayEmail(params: GiveawayKlaviyoProfile): Promise<string | null> {
  const fromCaller = params.userEmail?.trim() || null
  if (fromCaller) return fromCaller
  return getAuthEmailForUserId(params.userId)
}

function giveawayAbsoluteUrls(preferredBrand: GiveawayPrizeBrandId | null): {
  listUrl: string
  giveawayUrl: string
} {
  const origin = publicSiteOriginForEmail().replace(/\/$/, "")
  return {
    listUrl: `${origin}${giveawaySellHref(preferredBrand)}`,
    giveawayUrl: `${origin}${GIVEAWAYS_INDEX_HREF}`,
  }
}

function giveawayEventProperties(params: {
  giveawaySlug: string
  preferredBrand: GiveawayPrizeBrandId | null
  status: GiveawayEntry["status"]
  listingId?: string | null
  extra?: Record<string, unknown>
}): Record<string, unknown> {
  const giveaway = getGiveawayBySlug(params.giveawaySlug)
  const brand = params.preferredBrand ? getGiveawayPrizeBrand(params.preferredBrand) : null
  const { listUrl, giveawayUrl } = giveawayAbsoluteUrls(params.preferredBrand)
  const qualified = params.status === "qualified"

  return {
    time: new Date().toISOString(),
    giveaway_slug: params.giveawaySlug,
    giveaway_title: giveaway?.title ?? params.giveawaySlug,
    giveaway_headline: giveaway?.headline ?? "",
    prize_label: giveaway?.prizeLabel ?? "",
    schedule_label: giveaway?.scheduleLabel ?? "",
    ends_at: giveaway?.endsAt ?? "",
    ends_at_formatted: giveaway ? formatGiveawayEndDate(giveaway.endsAt) : "",
    winner_drawn_at: giveaway?.winnerDrawnAt ?? "",
    preferred_brand: params.preferredBrand,
    preferred_brand_name: brand?.name ?? "",
    status: params.status,
    qualified,
    listing_id: params.listingId ?? "",
    List_URL: listUrl,
    Resume_URL: listUrl,
    Giveaway_URL: giveawayUrl,
    next_step: qualified ? "you_are_in" : "list_surfboard",
    ...params.extra,
  }
}

export async function trackKlaviyoGiveawayEntered(params: {
  userId: string
  userEmail?: string | null
  giveawaySlug: string
  preferredBrand: GiveawayPrizeBrandId | null
  status: GiveawayEntry["status"]
  listingId?: string | null
}): Promise<void> {
  const email = await resolveGiveawayEmail(params)
  await sendKlaviyoServerEvent({
    metricName: GIVEAWAY_ENTERED_METRIC,
    uniqueId: `giveaway-entered-${params.userId}-${params.giveawaySlug}`,
    profile: {
      external_id: params.userId,
      email,
    },
    properties: giveawayEventProperties({
      giveawaySlug: params.giveawaySlug,
      preferredBrand: params.preferredBrand,
      status: params.status,
      listingId: params.listingId,
    }),
  })
}

export async function trackKlaviyoGiveawayQualified(params: {
  userId: string
  userEmail?: string | null
  giveawaySlug: string
  listingId: string
  preferredBrand: GiveawayPrizeBrandId | null
}): Promise<void> {
  const email = await resolveGiveawayEmail(params)
  await sendKlaviyoServerEvent({
    metricName: GIVEAWAY_QUALIFIED_METRIC,
    uniqueId: `giveaway-qualified-${params.userId}-${params.giveawaySlug}`,
    profile: {
      external_id: params.userId,
      email,
    },
    properties: giveawayEventProperties({
      giveawaySlug: params.giveawaySlug,
      preferredBrand: params.preferredBrand,
      status: "qualified",
      listingId: params.listingId,
    }),
  })
}

export async function trackKlaviyoGiveawayListingReminder(params: {
  userId: string
  userEmail?: string | null
  giveawaySlug: string
  entryId: string
  preferredBrand: GiveawayPrizeBrandId | null
  enteredAt: string
}): Promise<Awaited<ReturnType<typeof sendKlaviyoServerEvent>>> {
  const email = await resolveGiveawayEmail(params)
  const hoursSinceEntry = Math.max(
    0,
    Math.round((Date.now() - new Date(params.enteredAt).getTime()) / (60 * 60 * 1000)),
  )

  return sendKlaviyoServerEvent({
    metricName: GIVEAWAY_LISTING_REMINDER_METRIC,
    uniqueId: `giveaway-listing-reminder-${params.entryId}`,
    profile: {
      external_id: params.userId,
      email,
    },
    properties: giveawayEventProperties({
      giveawaySlug: params.giveawaySlug,
      preferredBrand: params.preferredBrand,
      status: "pending",
      extra: {
        entered_at: params.enteredAt,
        hours_since_entry: hoursSinceEntry,
        "Needs listing nudge": true,
      },
    }),
  })
}
