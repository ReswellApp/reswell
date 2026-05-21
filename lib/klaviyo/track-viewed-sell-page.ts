/**
 * Server-only: Klaviyo **Viewed Sell Page** — signed-in sellers on `/sell`.
 *
 * **Abandoned listing flow (build in Klaviyo):**
 * 1. Flows → Create flow → Metric → **Viewed Sell Page**.
 * 2. Trigger filter: `Logged in` equals **true** (all app events use `external_id`).
 * 3. Optional: `Needs listing nudge` equals **true** — skips sellers only editing a live listing
 *    (`Sell page mode` = edit and `Edit listing status` = active).
 * 4. Time delay (e.g. 2 hours) → conditional split: profile has done **Listing** at least once
 *    **since starting this flow** → Yes → exit (they published). No → send “Finish your listing”.
 * 5. Repeat delay + split (24h, 72h) as needed. CTA: `{{ event.Sell page URL }}` or `/sell?new=1`.
 * 6. Flow setting: allow re-entry after 14–30 days so return visits can restart the sequence.
 *
 * Deduped to **one event per profile per UTC day** (`unique_id`) so query-param churn on `/sell`
 * does not spawn multiple concurrent flows.
 *
 * @see lib/services/klaviyoPageView.ts — boards/site metrics unchanged
 */

import { publicSiteOrigin } from "@/lib/public-site-origin"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import type { SellPageViewContext } from "@/lib/klaviyo/sell-page-view-context"

export type TrackKlaviyoViewedSellPageInput = {
  userId: string
  email: string | null
  pathname: string
  path: string
  search?: string
  sellContext: SellPageViewContext
  activeListingCount: number
  draftListingCount: number
  editListingStatus: string | null
}

function sellPageUrl(path: string): string {
  const origin = publicSiteOrigin()
  return path.startsWith("http") ? path : `${origin}${path.startsWith("/") ? path : `/${path}`}`
}

function needsListingNudge(input: TrackKlaviyoViewedSellPageInput): boolean {
  const { sellContext, editListingStatus } = input
  if (sellContext.mode === "new" || sellContext.mode === "landing") return true
  if (sellContext.mode === "edit" && editListingStatus === "active") return false
  return true
}

function uniqueIdForDay(userId: string): string {
  const day = new Date().toISOString().slice(0, 10)
  return `viewed-sell-page-${userId}-${day}`
}

export async function trackKlaviyoViewedSellPage(
  input: TrackKlaviyoViewedSellPageInput,
): Promise<void> {
  const {
    userId,
    email,
    pathname,
    path,
    search,
    sellContext,
    activeListingCount,
    draftListingCount,
    editListingStatus,
  } = input

  const modeLabel =
    sellContext.mode === "new"
      ? "new"
      : sellContext.mode === "edit"
        ? "edit"
        : "landing"

  await sendKlaviyoServerEvent({
    metricName: "Viewed Sell Page",
    uniqueId: uniqueIdForDay(userId),
    profile: {
      external_id: userId,
      email,
    },
    properties: {
      Path: path,
      Pathname: pathname,
      ...(search
        ? {
            Search: search.startsWith("?") ? search.slice(1) : search,
          }
        : {}),
      "Page segment": "sell",
      "Logged in": true,
      "Sell page mode": modeLabel,
      "Sell page URL": sellPageUrl(path),
      "Edit listing id": sellContext.editListingId ?? "",
      "Edit listing status": editListingStatus ?? "",
      "Active listing count": activeListingCount,
      "Draft listing count": draftListingCount,
      "Needs listing nudge": needsListingNudge(input),
    },
  })
}
