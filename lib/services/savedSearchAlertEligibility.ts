/**
 * Rules for the "a new board matches your search" email.
 *
 * Saving a search never sends that email. It goes out only when a listing
 * is listed strictly after the search was saved, and only when the listing
 * has a title, a price, and a link.
 */

const MIN_ALERT_PRICE = 0.01

export function parseAlertTimestamp(value: string | null | undefined): number | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const ms = Date.parse(trimmed)
  return Number.isFinite(ms) ? ms : null
}

/**
 * True when `listingListedAt` is strictly after `savedSearchCreatedAt`.
 * Missing or unparseable timestamps are not eligible — we will not guess.
 */
export function listingListedAfterSavedSearch(
  listingListedAt: string | null | undefined,
  savedSearchCreatedAt: string | null | undefined,
): boolean {
  const listed = parseAlertTimestamp(listingListedAt)
  const saved = parseAlertTimestamp(savedSearchCreatedAt)
  if (listed == null || saved == null) return false
  return listed > saved
}

export type BoardAlertListingContent = {
  title: string
  price: number
  listingUrl: string
}

/**
 * Listing fields the match email is allowed to render.
 * Returns null when the email would be blank (empty title, missing price, or no link).
 */
export function boardAlertListingContent(input: {
  title: string | null | undefined
  price: number | string | null | undefined
  listingUrl: string | null | undefined
}): BoardAlertListingContent | null {
  const title = typeof input.title === "string" ? input.title.trim() : ""
  if (!title) return null

  const price = typeof input.price === "number" ? input.price : Number(input.price)
  if (!Number.isFinite(price) || price < MIN_ALERT_PRICE) return null

  const listingUrl = typeof input.listingUrl === "string" ? input.listingUrl.trim() : ""
  if (!/^https?:\/\//i.test(listingUrl)) return null

  return { title, price, listingUrl }
}
