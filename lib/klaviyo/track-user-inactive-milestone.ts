/**
 * Klaviyo Events API — milestones when a user has been inactive (no presence heartbeat).
 *
 * **Eligibility:** `profiles.last_active_at` is strictly older than N days (`N` ∈ {3, 15, 30}).
 * Users with no `last_active_at` never receive these metrics (presence never ran).
 *
 * **Metrics (Flows → Metric → …):**
 * - **User Inactive 3 Days**
 * - **User Inactive 15 Days**
 * - **User Inactive 30 Days**
 *
 * **Building flows:** One flow per metric, or duplicate steps with conditional branches.
 * Add a conditional split before email: suppress if someone has done X **since metric**
 * using page-view / commerce metrics (e.g. **Viewed Site Page**, **Listing**, **Purchase Successful**).
 *
 * **Rendering in Klaviyo:** Email clients do **not** support iframes. Do not print `featured_listings`
 * as a single variable (you get a raw object dump). Either:
 * 1. Add a **custom HTML** block and use `{{ event.featured_listings_html }}` (pre-built table + images), or
 * 2. Use **Liquid** in a custom HTML block, e.g.
 *    `{% for item in event.featured_listings %} … <a href="{{ item.url }}"> … {% endfor %}`
 *    (`item.url` is built for the Reswell production host — see `KLAVIYO_EMAIL_SITE_URL` / `publicSiteOriginForEmail`.)
 * Also set **plain text** body from `{{ event.featured_listings_plain }}` if you want a text fallback.
 *
 * Cron: `GET /api/cron/klaviyo-inactivity-milestones` with `Authorization: Bearer $CRON_SECRET`
 * when `CRON_SECRET` is set · see `vercel.json`.
 *
 * Manual test: `POST /api/integrations/klaviyo/trigger-inactive-milestone` (same Bearer when `CRON_SECRET` is set).
 *
 * Metrics only appear under Flows → Your metrics → API after Klaviyo has accepted **at least one event** per name.
 * Run once: `POST /api/integrations/klaviyo/bootstrap-inactive-metrics` (Bearer `CRON_SECRET` when set).
 */

import type { KlaviyoInactiveFeaturedListing } from "@/lib/klaviyo/inactivity-featured-listings"
import {
  resolveListingUrlForEmail,
  resolveMarketplaceBoardsUrlForEmail,
} from "@/lib/klaviyo/email-listing-links"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"

export type KlaviyoUserInactiveMilestoneDays = 3 | 15 | 30

/** Exported so seed/bootstrap and docs stay aligned with Klaviyo’s metric catalog. */
export const INACTIVE_MILESTONE_METRIC_NAMES: Record<
  KlaviyoUserInactiveMilestoneDays,
  string
> = {
  3: "User Inactive 3 Days",
  15: "User Inactive 15 Days",
  30: "User Inactive 30 Days",
}

export type TrackKlaviyoUserInactiveMilestonePayload = {
  userId: string
  /** Prefer public profile email; Auth email used when null (see caller). */
  email: string | null
  displayName: string | null
  milestoneDays: KlaviyoUserInactiveMilestoneDays
  lastActiveAtIso: string
  /** Newest listings for email modules (may be empty if catalog is thin). */
  featuredListings: KlaviyoInactiveFeaturedListing[]
  /**
   * When set, appended to Klaviyo `unique_id` (e.g. manual test nonce) so the event is not deduped
   * against production cron sends.
   */
  uniqueIdSuffix?: string
}

export async function trackKlaviyoUserInactiveMilestone(
  payload: TrackKlaviyoUserInactiveMilestonePayload,
): Promise<Awaited<ReturnType<typeof sendKlaviyoServerEvent>>> {
  const eventTime = new Date().toISOString()
  const metricName = INACTIVE_MILESTONE_METRIC_NAMES[payload.milestoneDays]

  const featured = payload.featuredListings ?? []
  const marketplace_url = resolveMarketplaceBoardsUrlForEmail()

  const listings_html = buildInactiveFeaturedListingsEmailHtml(featured, marketplace_url)
  const listings_plain = buildInactiveFeaturedListingsPlainText(featured, marketplace_url)

  const baseId = `user-inactive-${payload.milestoneDays}d-${payload.userId}`
  const suffix =
    typeof payload.uniqueIdSuffix === "string" && payload.uniqueIdSuffix.trim()
      ? `-${payload.uniqueIdSuffix.trim()}`
      : ""

  return sendKlaviyoServerEvent({
    metricName,
    profile: {
      external_id: payload.userId,
      email: payload.email,
    },
    uniqueId: `${baseId}${suffix}`,
    properties: {
      time: eventTime,
      inactive_milestone_days: payload.milestoneDays,
      last_active_at: payload.lastActiveAtIso,
      user_id: payload.userId,
      display_name: payload.displayName?.trim() ?? "",
      featured_listings: featured.map((l) => ({ ...l })),
      featured_listings_count: featured.length,
      featured_listings_html: listings_html,
      featured_listings_plain: listings_plain,
      /** Browse CTA — primary boards marketplace */
      marketplace_url,
    },
  })
}
