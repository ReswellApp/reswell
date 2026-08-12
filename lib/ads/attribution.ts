/**
 * First-party ad click attribution — parse landing params, classify channel, cookie + Stripe metadata.
 * Last-click: a new gclid / fbclid / paid UTM overwrites the stored snapshot for 90 days.
 */

export const AD_ATTR_COOKIE = "rw_ad_attr"
export const AD_ATTR_MAX_AGE_SEC = 90 * 24 * 60 * 60
export const STRIPE_AD_ATTR_METADATA_KEY = "rw_ad"
const STRIPE_METADATA_MAX_CHARS = 500

export const AD_CHANNELS = ["google_ads", "meta_ads", "meta_referral", "other"] as const
export type AdChannel = (typeof AD_CHANNELS)[number]

export type AdAttributionSnapshot = {
  source: string | null
  medium: string | null
  campaign: string | null
  content: string | null
  term: string | null
  gclid: string | null
  gbraid: string | null
  wbraid: string | null
  fbclid: string | null
  landingPath: string | null
  landingListingId: string | null
  capturedAt: string
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const PAID_MEDIUMS = new Set([
  "cpc",
  "ppc",
  "paid",
  "paidsearch",
  "paid_search",
  "paid-search",
  "shopping",
  "display",
  "paidsocial",
  "paid_social",
  "paid-social",
])

const GOOGLE_SOURCES = new Set(["google", "googleads", "google ads", "google-ads", "adwords"])
const META_CAMPAIGNS = new Set(["meta_catalog", "meta_ads"])

function trimTo(value: string | null | undefined, max: number): string | null {
  const t = typeof value === "string" ? value.trim() : ""
  if (!t) return null
  return t.length > max ? t.slice(0, max) : t
}

function isUuid(value: string | null | undefined): boolean {
  return Boolean(value && UUID_RE.test(value.trim()))
}

export function listingIdFromLandingPath(path: string | null | undefined): string | null {
  if (!path) return null
  const match = /^\/l\/([^/?#]+)/.exec(path)
  if (!match?.[1]) return null
  try {
    const segment = decodeURIComponent(match[1]).trim()
    return isUuid(segment) ? segment : null
  } catch {
    return null
  }
}

function isMetaHost(source: string | null): boolean {
  const s = (source ?? "").trim().toLowerCase()
  if (!s) return false
  return (
    s === "fb" ||
    s === "ig" ||
    s === "meta" ||
    s === "an" ||
    s.includes("facebook") ||
    s.includes("instagram")
  )
}

export function classifyAdChannel(snapshot: AdAttributionSnapshot): AdChannel {
  if (snapshot.gclid || snapshot.gbraid || snapshot.wbraid) return "google_ads"
  const source = (snapshot.source ?? "").trim().toLowerCase()
  const medium = (snapshot.medium ?? "").trim().toLowerCase()
  const campaign = (snapshot.campaign ?? "").trim().toLowerCase()
  if (GOOGLE_SOURCES.has(source) && PAID_MEDIUMS.has(medium)) return "google_ads"
  if (META_CAMPAIGNS.has(campaign) || (isMetaHost(source) && PAID_MEDIUMS.has(medium))) {
    return "meta_ads"
  }
  if (snapshot.fbclid || isMetaHost(source)) return "meta_referral"
  return "other"
}

export function snapshotHasAdSignal(snapshot: AdAttributionSnapshot): boolean {
  return classifyAdChannel(snapshot) !== "other"
}

function param(search: URLSearchParams, key: string, max: number): string | null {
  return trimTo(search.get(key), max)
}

export function parseAdAttributionFromSearch(input: {
  search: URLSearchParams
  pathname?: string | null
}): AdAttributionSnapshot | null {
  const { search } = input
  const gclid = param(search, "gclid", 200)
  const gbraid = param(search, "gbraid", 200)
  const wbraid = param(search, "wbraid", 200)
  const fbclid = param(search, "fbclid", 200)
  const source = param(search, "utm_source", 120)
  const medium = param(search, "utm_medium", 80)
  const campaign = param(search, "utm_campaign", 180)
  const content = param(search, "utm_content", 120)
  const term = param(search, "utm_term", 120)

  if (!gclid && !gbraid && !wbraid && !fbclid && !source && !medium && !campaign) {
    return null
  }

  const landingPath = trimTo(input.pathname, 240)
  const fromContent = isUuid(content) ? content!.trim() : null
  const fromPath = listingIdFromLandingPath(landingPath)

  return {
    source,
    medium,
    campaign,
    content,
    term,
    gclid,
    gbraid,
    wbraid,
    fbclid,
    landingPath,
    landingListingId: fromContent ?? fromPath,
    capturedAt: new Date().toISOString(),
  }
}

function snapshotFromUnknown(parsed: unknown): AdAttributionSnapshot | null {
  if (!parsed || typeof parsed !== "object") return null
  const row = parsed as Record<string, unknown>
  const str = (key: string, max: number): string | null =>
    typeof row[key] === "string" ? trimTo(row[key] as string, max) : null
  const snapshot: AdAttributionSnapshot = {
    source: str("source", 120),
    medium: str("medium", 80),
    campaign: str("campaign", 180),
    content: str("content", 120),
    term: str("term", 120),
    gclid: str("gclid", 200),
    gbraid: str("gbraid", 200),
    wbraid: str("wbraid", 200),
    fbclid: str("fbclid", 200),
    landingPath: str("landingPath", 240),
    landingListingId: str("landingListingId", 36),
    capturedAt: str("capturedAt", 40) ?? new Date().toISOString(),
  }
  if (
    !snapshot.gclid &&
    !snapshot.gbraid &&
    !snapshot.wbraid &&
    !snapshot.fbclid &&
    !snapshot.source &&
    !snapshot.medium &&
    !snapshot.campaign
  ) {
    return null
  }
  return snapshot
}

export function parseAdAttributionCookie(raw: string | null | undefined): AdAttributionSnapshot | null {
  if (!raw?.trim()) return null
  try {
    return snapshotFromUnknown(JSON.parse(decodeURIComponent(raw.trim())))
  } catch {
    return null
  }
}

export function serializeAdAttributionCookie(snapshot: AdAttributionSnapshot): string {
  return encodeURIComponent(JSON.stringify(snapshot))
}

export function serializeAttributionForStripe(snapshot: AdAttributionSnapshot): string | null {
  const compact: AdAttributionSnapshot = { ...snapshot }
  let json = JSON.stringify(compact)
  if (json.length <= STRIPE_METADATA_MAX_CHARS) return json

  compact.term = null
  compact.landingPath = compact.landingPath ? compact.landingPath.slice(0, 80) : null
  json = JSON.stringify(compact)
  if (json.length <= STRIPE_METADATA_MAX_CHARS) return json

  compact.gclid = compact.gclid ? compact.gclid.slice(0, 100) : null
  compact.fbclid = compact.fbclid ? compact.fbclid.slice(0, 100) : null
  compact.gbraid = null
  compact.wbraid = null
  json = JSON.stringify(compact)
  return json.length <= STRIPE_METADATA_MAX_CHARS ? json : null
}

export function parseStripeAttributionMetadata(raw: string | null | undefined): AdAttributionSnapshot | null {
  if (!raw?.trim()) return null
  try {
    return snapshotFromUnknown(JSON.parse(raw.trim()))
  } catch {
    return null
  }
}

export function stripeAdAttributionMetadata(
  snapshot: AdAttributionSnapshot | null,
): Record<string, string> {
  if (!snapshot || !snapshotHasAdSignal(snapshot)) return {}
  const raw = serializeAttributionForStripe(snapshot)
  return raw ? { [STRIPE_AD_ATTR_METADATA_KEY]: raw } : {}
}

export function adAttributionCookieHeader(snapshot: AdAttributionSnapshot, secure: boolean): string {
  const parts = [
    `${AD_ATTR_COOKIE}=${serializeAdAttributionCookie(snapshot)}`,
    "Path=/",
    `Max-Age=${AD_ATTR_MAX_AGE_SEC}`,
    "SameSite=Lax",
  ]
  if (secure) parts.push("Secure")
  return parts.join("; ")
}
