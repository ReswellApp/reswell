import type { SupabaseClient } from "@supabase/supabase-js"

import { fetchSellerSellPageKlaviyoContext } from "@/lib/db/sellerSellPageKlaviyoContext"
import { getAuthEmailForUserId } from "@/lib/klaviyo/auth-user-email"
import {
  klaviyoPageViewMetricForPathname,
  type KlaviyoPageViewSegment,
} from "@/lib/klaviyo/page-view-path"
import { sellPageViewContextFromPath } from "@/lib/klaviyo/sell-page-view-context"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import { trackKlaviyoViewedListing } from "@/lib/klaviyo/track-viewed-listing"
import { trackKlaviyoViewedSellPage } from "@/lib/klaviyo/track-viewed-sell-page"

export type { KlaviyoPageViewSegment }
export { klaviyoPageViewMetricForPathname }

function fullPathFromParts(pathname: string, search: string | undefined): string {
  if (!search?.trim()) return pathname
  const q = search.startsWith("?") ? search.slice(1) : search
  return `${pathname}?${q}`
}

export type TrackKlaviyoPageViewInput = {
  pathname: string
  search?: string
  /** Logged-out profile id from the client */
  anonymousId?: string | null
  loggedInUserId?: string | null
  /** Session email when available (avoids service lookup on every view) */
  loggedInUserEmail?: string | null
  /** Required for `/sell` seller context (listing counts, edit status) */
  supabase?: SupabaseClient
}

/**
 * Fires a Klaviyo Events API metric for SPA / full navigation page views.
 *
 * **Metrics (create in Klaviyo under Flows → Metric):**
 * - **Viewed Listing** — `/l/{slug-or-id}` browse abandonment (product fields when the listing loads)
 * - **Viewed Sell Page** — signed-in `/sell` only; see `track-viewed-sell-page.ts` for abandoned-listing flow
 * - **Viewed Boards Page** — `/boards` and `/boards/...` (catalog, not one board)
 * - **Viewed Site Page** — all other paths. Too broad for a product email.
 *
 * All events include `Path` (pathname + query), `Pathname`, `Page segment` for reporting.
 */
export async function trackKlaviyoPageView(
  input: TrackKlaviyoPageViewInput,
): Promise<void> {
  const pathname = input.pathname.trim()
  const search =
    typeof input.search === "string" ? input.search.trim() : undefined
  const { metricName, segment } = klaviyoPageViewMetricForPathname(pathname)
  const path = fullPathFromParts(pathname, search)

  let email: string | null =
    typeof input.loggedInUserEmail === "string"
      ? input.loggedInUserEmail.trim() || null
      : null
  const userId =
    typeof input.loggedInUserId === "string"
      ? input.loggedInUserId.trim() || null
      : null

  if (segment === "sell") {
    if (!userId) return
    if (!email) {
      email = await getAuthEmailForUserId(userId)
    }
    const sellContext = sellPageViewContextFromPath(pathname, search)
    if (!sellContext) return

    let activeListingCount = 0
    let draftListingCount = 0
    let editListingStatus: string | null = null
    if (input.supabase) {
      const ctx = await fetchSellerSellPageKlaviyoContext(
        input.supabase,
        userId,
        sellContext.editListingId,
      )
      activeListingCount = ctx.activeListingCount
      draftListingCount = ctx.draftListingCount
      editListingStatus = ctx.editListingStatus
    }

    await trackKlaviyoViewedSellPage({
      userId,
      email,
      pathname,
      path,
      search,
      sellContext,
      activeListingCount,
      draftListingCount,
      editListingStatus,
    })
    return
  }

  if (userId && !email) {
    email = await getAuthEmailForUserId(userId)
  }

  if (segment === "listing") {
    await trackKlaviyoViewedListing({
      pathname,
      path,
      search,
      userId,
      email,
      anonymousId:
        typeof input.anonymousId === "string" ? input.anonymousId.trim() || null : null,
      supabase: input.supabase,
    })
    return
  }

  const anon =
    typeof input.anonymousId === "string"
      ? input.anonymousId.trim() || null
      : null

  const profile =
    userId != null
      ? { external_id: userId, email }
      : { anonymous_id: anon ?? undefined }

  await sendKlaviyoServerEvent({
    metricName,
    uniqueId: crypto.randomUUID(),
    profile,
    properties: {
      Path: path,
      Pathname: pathname,
      ...(search ? { Search: search.startsWith("?") ? search.slice(1) : search } : {}),
      "Page segment": segment,
    },
  })
}
