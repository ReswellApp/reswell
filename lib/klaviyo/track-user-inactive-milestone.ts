/**
 * Klaviyo Events API — **User Inactive 30 Days** when a user has not signed in for 30 days.
 *
 * **Eligibility:** `auth.users.last_sign_in_at` is strictly older than 30 days (or `created_at`
 * if never signed in). Inactivity resets only on a new sign-in — not from presence heartbeats
 * or server-side activity like messages/orders.
 *
 * **Metric (Flows → Metric → …):** **User Inactive 30 Days**
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
 * Metric appears under Flows → Your metrics → API after Klaviyo accepts **at least one event**.
 * Run once: `POST /api/integrations/klaviyo/bootstrap-inactive-metrics` (Bearer `CRON_SECRET` when set).
 */

import type { KlaviyoInactiveFeaturedListing } from "@/lib/klaviyo/inactivity-featured-listings"
import {
  buildInactiveFeaturedListingsEmailHtml,
  buildInactiveFeaturedListingsPlainText,
} from "@/lib/klaviyo/inactive-featured-listings-email-html"
import {
  resolveListingUrlForEmail,
  resolveMarketplaceBoardsUrlForEmail,
} from "@/lib/klaviyo/email-listing-links"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"

export const KLAVIYO_USER_INACTIVE_MILESTONE_DAYS = 30 as const
export type KlaviyoUserInactiveMilestoneDays = typeof KLAVIYO_USER_INACTIVE_MILESTONE_DAYS

export const USER_INACTIVE_30_DAYS_METRIC = "User Inactive 30 Days"

/** @deprecated Use `USER_INACTIVE_30_DAYS_METRIC` — kept for bootstrap route compatibility. */
export const INACTIVE_MILESTONE_METRIC_NAMES: Record<
  KlaviyoUserInactiveMilestoneDays,
  string
> = {
  30: USER_INACTIVE_30_DAYS_METRIC,
}

export type TrackKlaviyoUserInactiveMilestonePayload = {
  userId: string
  /** Prefer public profile email; Auth email used when null (see caller). */
  email: string | null
  displayName: string | null
  milestoneDays?: KlaviyoUserInactiveMilestoneDays
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
  const milestoneDays = payload.milestoneDays ?? KLAVIYO_USER_INACTIVE_MILESTONE_DAYS
  const eventTime = new Date().toISOString()

  const featured = payload.featuredListings ?? []
  const marketplace_url = resolveMarketplaceBoardsUrlForEmail()

  const listings_html = buildInactiveFeaturedListingsEmailHtml(featured, marketplace_url)
  const listings_plain = buildInactiveFeaturedListingsPlainText(featured, marketplace_url)

  const baseId = `user-inactive-${milestoneDays}d-${payload.userId}`
  const suffix =
    typeof payload.uniqueIdSuffix === "string" && payload.uniqueIdSuffix.trim()
      ? `-${payload.uniqueIdSuffix.trim()}`
      : ""

  return sendKlaviyoServerEvent({
    metricName: USER_INACTIVE_30_DAYS_METRIC,
    profile: {
      external_id: payload.userId,
      email: payload.email,
    },
    uniqueId: `${baseId}${suffix}`,
    properties: {
      time: eventTime,
      inactive_milestone_days: milestoneDays,
      last_signed_in_at: payload.lastActiveAtIso,
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
