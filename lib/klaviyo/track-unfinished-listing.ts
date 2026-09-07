/**
 * Server-only: Klaviyo **Unfinished Listing** when a signed-in seller started
 * `/sell` and left a `draft` row without publishing.
 *
 * **Building the flow in Klaviyo:**
 * 1. Flows → Create flow → Metric → **Unfinished Listing**.
 * 2. Trigger filter: `reswell_metric_seed` is not true (ignore bootstrap).
 * 3. Optional delay (event already waits 2 hours after last edit).
 * 4. Conditional split: profile has done **Listing** at least once since this
 *    flow started → Yes → exit (they published). No → send “Finish your listing”.
 * 5. CTA: `{{ event.Resume_URL }}`. Also available: `Title`, `Price`,
 *    `photo_url`, `captured_fields_plain`, `section_label`.
 * 6. Allow re-entry after 14–30 days if you want a second pass; app unique_id
 *    is once per listing so Klaviyo will not re-accept the same draft.
 *
 * Cron: `GET /api/cron/klaviyo-unfinished-listings`
 * Bootstrap: `POST /api/integrations/klaviyo/bootstrap-unfinished-listing-metric`
 */

import { getAuthEmailForUserId } from "@/lib/klaviyo/auth-user-email"
import {
  absoluteKlaviyoListingImageUrl,
  formatKlaviyoPriceDisplay,
  parseKlaviyoListingPrice,
} from "@/lib/klaviyo/catalog-product"
import {
  isPeerListingSection,
  PEER_LISTING_SECTION_LABELS,
  peerListingEditHref,
} from "@/lib/peer-listing-sections"
import { publicSiteOriginForEmail } from "@/lib/public-site-origin"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import type { UnfinishedListingDraftRow } from "@/lib/db/unfinishedListingNudges"

export const UNFINISHED_LISTING_METRIC = "Unfinished Listing"

const DESCRIPTION_MAX = 800

export type TrackKlaviyoUnfinishedListingPayload = {
  listing: UnfinishedListingDraftRow
  sellerEmail?: string | null
  uniqueIdSuffix?: string
}

function sectionLabel(section: string | null): string {
  if (isPeerListingSection(section)) return PEER_LISTING_SECTION_LABELS[section]
  return section?.trim() || "Listing"
}

function displayTitle(row: UnfinishedListingDraftRow): string {
  const title = row.title?.trim() ?? ""
  if (title && title !== "Untitled draft") return title
  return `Unfinished ${sectionLabel(row.section).toLowerCase()} listing`
}

function truncateDescription(raw: string | null): string {
  const trimmed = raw?.trim() ?? ""
  if (!trimmed || trimmed === " ") return ""
  if (trimmed.length <= DESCRIPTION_MAX) return trimmed
  return `${trimmed.slice(0, DESCRIPTION_MAX)}…`
}

function formatDimensions(row: UnfinishedListingDraftRow): string {
  const feet = row.length_feet
  const inches = row.length_inches
  const width = row.width
  const thickness = row.thickness
  const volume = row.volume
  const parts: string[] = []
  if (feet != null && feet > 0) {
    const inPart = inches != null && inches > 0 ? ` ${inches}"` : ""
    parts.push(`${feet}'${inPart}`.trim())
  }
  if (width != null && width > 0) parts.push(`${width}" W`)
  if (thickness != null && thickness > 0) parts.push(`${thickness}" T`)
  if (volume != null && volume > 0) parts.push(`${volume}L`)
  return parts.join(" · ")
}

function locationLabel(row: UnfinishedListingDraftRow): string {
  return [row.city, row.state].filter(Boolean).join(", ")
}

export function unfinishedListingCapturedFields(row: UnfinishedListingDraftRow): string[] {
  const fields: string[] = []
  const title = row.title?.trim() ?? ""
  if (title && title !== "Untitled draft") fields.push("title")
  if ((row.price ?? 0) > 0) fields.push("price")
  if ((row.listing_images ?? []).length > 0) fields.push("photos")
  if (truncateDescription(row.description)) fields.push("description")
  if (row.brand) fields.push("brand")
  if (row.model) fields.push("model")
  if (row.condition) fields.push("condition")
  if (row.board_type) fields.push("board_type")
  if (formatDimensions(row)) fields.push("dimensions")
  if (locationLabel(row)) fields.push("location")
  if (row.local_pickup != null || row.shipping_available != null) fields.push("fulfillment")
  return fields
}

export async function trackKlaviyoUnfinishedListing(
  payload: TrackKlaviyoUnfinishedListingPayload,
): Promise<Awaited<ReturnType<typeof sendKlaviyoServerEvent>>> {
  const { listing } = payload
  let sellerEmail = payload.sellerEmail?.trim() || null
  if (!sellerEmail) {
    sellerEmail = await getAuthEmailForUserId(listing.user_id)
  }

  const origin = publicSiteOriginForEmail().replace(/\/$/, "")
  const resumePath = peerListingEditHref(listing.section, listing.id)
  const resumeUrl = `${origin}${resumePath}`
  const title = displayTitle(listing)
  const price = parseKlaviyoListingPrice(listing.price)
  const photoUrl = absoluteKlaviyoListingImageUrl({
    id: listing.id,
    title,
    section: listing.section,
    listing_images: listing.listing_images,
  })
  const captured = unfinishedListingCapturedFields(listing)
  const photosCount = listing.listing_images?.length ?? 0
  const hoursSinceUpdate = Math.max(
    0,
    Math.round((Date.now() - new Date(listing.updated_at).getTime()) / (60 * 60 * 1000)),
  )

  const suffix =
    typeof payload.uniqueIdSuffix === "string" && payload.uniqueIdSuffix.trim()
      ? `-${payload.uniqueIdSuffix.trim()}`
      : ""

  return sendKlaviyoServerEvent({
    metricName: UNFINISHED_LISTING_METRIC,
    uniqueId: `unfinished-listing-${listing.id}${suffix}`,
    profile: {
      external_id: listing.user_id,
      email: sellerEmail,
    },
    value: price ?? undefined,
    valueCurrency: price != null ? "USD" : undefined,
    properties: {
      time: new Date().toISOString(),
      Created: false,
      Title: title,
      Price: price ?? 0,
      price_display: formatKlaviyoPriceDisplay(price),
      photo_url: photoUrl,
      listing_id: listing.id,
      section: listing.section ?? "",
      section_label: sectionLabel(listing.section),
      Brand: listing.brand ?? "",
      Model: listing.model ?? "",
      Condition: listing.condition ?? "",
      board_type: listing.board_type ?? "",
      Dimensions: formatDimensions(listing),
      Location: locationLabel(listing),
      description: truncateDescription(listing.description),
      photo_count: photosCount,
      has_photos: photosCount > 0,
      has_price: (price ?? 0) > 0,
      has_title: Boolean(listing.title && listing.title !== "Untitled draft"),
      local_pickup: listing.local_pickup === true,
      shipping_available: listing.shipping_available === true,
      Resume_URL: resumeUrl,
      "Sell page URL": resumeUrl,
      captured_fields: captured,
      captured_fields_plain: captured.join(", "),
      captured_field_count: captured.length,
      started_at: listing.created_at,
      last_edited_at: listing.updated_at,
      hours_since_update: hoursSinceUpdate,
      "Needs listing nudge": true,
    },
  })
}
