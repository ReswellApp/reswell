/**
 * Denormalized why a listing is hidden from the public site.
 * Stored on `listings.site_visibility_reason` when `hidden_from_site` is true.
 * Cleared (null) when the listing is shown again.
 */

export const SITE_VISIBILITY_REASONS = [
  "seller_vacation",
  "seller_inactivity",
  "admin_site_visibility",
  "seller_archive",
  "admin_status",
  "system",
  "seller_ban",
] as const

export type SiteVisibilityReason = (typeof SITE_VISIBILITY_REASONS)[number]

const REASON_SET = new Set<string>(SITE_VISIBILITY_REASONS)

export function isSiteVisibilityReason(value: string | null | undefined): value is SiteVisibilityReason {
  return value != null && REASON_SET.has(value)
}

/** Map a visibility-event source to a denormalized reason when hiding. */
export function siteVisibilityReasonForHideSource(
  source: string | null | undefined,
): SiteVisibilityReason {
  if (source && REASON_SET.has(source)) {
    return source as SiteVisibilityReason
  }
  return "system"
}

/**
 * Value to persist with a hide/unhide write.
 * Unhide always clears the reason; hide stores the mapped reason.
 */
export function siteVisibilityReasonForWrite(
  hiddenFromSite: boolean,
  source?: string | null,
): SiteVisibilityReason | null {
  if (!hiddenFromSite) return null
  return siteVisibilityReasonForHideSource(source)
}
