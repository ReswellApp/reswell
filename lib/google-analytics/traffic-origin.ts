/**
 * Classify GA4 session source / medium / referrer into named origins
 * (ChatGPT, Claude, Google, …) so admin can see where visitors came from.
 */

export const TRAFFIC_ORIGIN_IDS = [
  "chatgpt",
  "claude",
  "perplexity",
  "gemini",
  "copilot",
  "google",
  "meta",
  "youtube",
  "direct",
  "other",
] as const

export type TrafficOriginId = (typeof TRAFFIC_ORIGIN_IDS)[number]

export const TRAFFIC_ORIGIN_LABEL: Record<TrafficOriginId, string> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  perplexity: "Perplexity",
  gemini: "Gemini",
  copilot: "Copilot / Bing",
  google: "Google",
  meta: "Meta / Instagram",
  youtube: "YouTube",
  direct: "Direct",
  other: "Other",
}

/** Origins always shown in admin even at 0 sessions — the question people ask first. */
export const PINNED_TRAFFIC_ORIGINS: readonly TrafficOriginId[] = [
  "chatgpt",
  "claude",
  "google",
  "direct",
]

const CHATGPT_HOSTS = new Set([
  "chatgpt.com",
  "chat.openai.com",
  "openai.com",
  "platform.openai.com",
  "com.openai.chat",
])

const CLAUDE_HOSTS = new Set(["claude.ai", "anthropic.com"])
const PERPLEXITY_HOSTS = new Set(["perplexity.ai", "www.perplexity.ai"])
const GEMINI_HOSTS = new Set(["gemini.google.com", "bard.google.com"])
const COPILOT_HOSTS = new Set([
  "copilot.microsoft.com",
  "bing.com",
  "www.bing.com",
  "edgeservices.bing.com",
])
const GOOGLE_HOSTS = new Set([
  "google",
  "google.com",
  "www.google.com",
  "googleads",
  "google ads",
  "adwords",
  "googleads.g.doubleclick.net",
  "search.google.com",
  "news.google.com",
])
const META_HOSTS = new Set([
  "facebook",
  "facebook.com",
  "www.facebook.com",
  "m.facebook.com",
  "l.facebook.com",
  "lm.facebook.com",
  "instagram",
  "instagram.com",
  "www.instagram.com",
  "l.instagram.com",
  "meta",
  "fb",
  "ig",
])
const YOUTUBE_HOSTS = new Set(["youtube", "youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"])

function normalizeToken(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase()
}

export function referrerHostname(referrer: string | null | undefined): string {
  const raw = (referrer ?? "").trim()
  if (!raw || raw === "(direct)" || raw === "(not set)" || raw === "(none)") return ""
  try {
    const url = raw.includes("://") ? new URL(raw) : new URL(`https://${raw}`)
    return url.hostname.replace(/^www\./, "").toLowerCase()
  } catch {
    return raw.replace(/^www\./, "").toLowerCase()
  }
}

function hostMatches(host: string, set: Set<string>): boolean {
  if (!host) return false
  if (set.has(host)) return true
  for (const candidate of set) {
    if (candidate.includes(".") && (host === candidate || host.endsWith(`.${candidate}`))) {
      return true
    }
  }
  return false
}

function tokenLooksLike(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => haystack.includes(needle))
}

export function classifyTrafficOrigin(input: {
  source?: string | null
  medium?: string | null
  referrer?: string | null
}): TrafficOriginId {
  const source = normalizeToken(input.source)
  const medium = normalizeToken(input.medium)
  const host = referrerHostname(input.referrer)
  const haystack = `${source} ${medium} ${host}`

  if (
    hostMatches(source, CHATGPT_HOSTS) ||
    hostMatches(host, CHATGPT_HOSTS) ||
    tokenLooksLike(haystack, ["chatgpt", "chat.openai", "openai.com", "com.openai.chat"])
  ) {
    return "chatgpt"
  }

  if (
    hostMatches(source, CLAUDE_HOSTS) ||
    hostMatches(host, CLAUDE_HOSTS) ||
    tokenLooksLike(haystack, ["claude.ai", "anthropic"])
  ) {
    return "claude"
  }

  if (
    hostMatches(source, PERPLEXITY_HOSTS) ||
    hostMatches(host, PERPLEXITY_HOSTS) ||
    tokenLooksLike(haystack, ["perplexity"])
  ) {
    return "perplexity"
  }

  if (
    hostMatches(source, GEMINI_HOSTS) ||
    hostMatches(host, GEMINI_HOSTS) ||
    tokenLooksLike(haystack, ["gemini.google", "bard.google"])
  ) {
    return "gemini"
  }

  if (
    hostMatches(source, COPILOT_HOSTS) ||
    hostMatches(host, COPILOT_HOSTS) ||
    tokenLooksLike(haystack, ["copilot.microsoft", "bing.com"]) ||
    source === "bing"
  ) {
    return "copilot"
  }

  if (hostMatches(source, META_HOSTS) || hostMatches(host, META_HOSTS) || tokenLooksLike(haystack, ["facebook", "instagram"])) {
    return "meta"
  }

  if (hostMatches(source, YOUTUBE_HOSTS) || hostMatches(host, YOUTUBE_HOSTS) || source === "youtube") {
    return "youtube"
  }

  if (
    hostMatches(source, GOOGLE_HOSTS) ||
    hostMatches(host, GOOGLE_HOSTS) ||
    source === "google" ||
    tokenLooksLike(source, ["google."])
  ) {
    return "google"
  }

  const unnamedSource =
    source === "" ||
    source === "(direct)" ||
    source === "(none)" ||
    source === "(not set)" ||
    source === "direct"
  const unnamedMedium = medium === "" || medium === "(none)" || medium === "(not set)"
  if (unnamedSource && !host && unnamedMedium) {
    return "direct"
  }

  return "other"
}

export function formatSourceLabel(source: string | null | undefined): string {
  const raw = (source ?? "").trim()
  if (!raw || raw === "(not set)" || raw === "(none)") return "(direct)"
  return raw
}

export function formatMediumLabel(medium: string | null | undefined): string {
  const raw = (medium ?? "").trim()
  if (!raw || raw === "(not set)" || raw === "(none)") return "(none)"
  return raw
}

const DEFAULT_OWN_PROPERTY_HOSTS = ["reswell.app"] as const

function isOwnPropertyHost(
  host: string,
  ownHosts: readonly string[] = DEFAULT_OWN_PROPERTY_HOSTS,
): boolean {
  if (!host || host === "(direct)") return false
  return ownHosts.some((own) => host === own || host.endsWith(`.${own}`))
}

export function mergeSourceMediumRows<
  T extends { source: string; medium: string; sessions: number; views: number; conversions: number },
>(rows: T[]): T[] {
  const byKey = new Map<string, T>()
  for (const row of rows) {
    const key = `${row.source}\0${row.medium}`
    const existing = byKey.get(key)
    if (existing) {
      existing.sessions += row.sessions
      existing.views += row.views
      existing.conversions += row.conversions
      continue
    }
    byKey.set(key, { ...row })
  }
  return [...byKey.values()].sort((a, b) => b.sessions - a.sessions || b.views - a.views)
}

export function rollupReferrersByHost(
  rows: Array<{ referrer: string; sessions: number }>,
  ownHosts: readonly string[] = DEFAULT_OWN_PROPERTY_HOSTS,
): Array<{
  host: string
  origin: TrafficOriginId
  originLabel: string
  sessions: number
}> {
  const byHost = new Map<
    string,
    { host: string; origin: TrafficOriginId; originLabel: string; sessions: number }
  >()
  for (const row of rows) {
    if (row.sessions <= 0) continue
    const host = referrerHostname(row.referrer) || "(direct)"
    if (isOwnPropertyHost(host, ownHosts)) continue
    const existing = byHost.get(host)
    if (existing) {
      existing.sessions += row.sessions
      continue
    }
    const origin = classifyTrafficOrigin({ referrer: row.referrer, source: host })
    byHost.set(host, {
      host,
      origin,
      originLabel: TRAFFIC_ORIGIN_LABEL[origin],
      sessions: row.sessions,
    })
  }
  return [...byHost.values()].sort((a, b) => b.sessions - a.sessions)
}

export function rollupTrafficOrigins<T extends { origin: TrafficOriginId; sessions: number; views: number; conversions: number }>(
  rows: T[],
): Array<{
  origin: TrafficOriginId
  label: string
  sessions: number
  views: number
  conversions: number
}> {
  const byOrigin = new Map<TrafficOriginId, { sessions: number; views: number; conversions: number }>()
  for (const id of TRAFFIC_ORIGIN_IDS) {
    byOrigin.set(id, { sessions: 0, views: 0, conversions: 0 })
  }
  for (const row of rows) {
    const current = byOrigin.get(row.origin)
    if (!current) continue
    current.sessions += row.sessions
    current.views += row.views
    current.conversions += row.conversions
  }

  const visible = TRAFFIC_ORIGIN_IDS.filter((id) => {
    const totals = byOrigin.get(id)
    if (!totals) return false
    if (PINNED_TRAFFIC_ORIGINS.includes(id)) return true
    return totals.sessions > 0 || totals.views > 0
  })

  return visible.map((origin) => {
    const totals = byOrigin.get(origin) ?? { sessions: 0, views: 0, conversions: 0 }
    return {
      origin,
      label: TRAFFIC_ORIGIN_LABEL[origin],
      ...totals,
    }
  })
}
