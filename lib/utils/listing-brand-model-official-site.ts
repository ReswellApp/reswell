/**
 * Conservative official-site checks for catalog auto-create.
 * Retailer / social / marketplace hosts are never treated as a model list.
 */

const BLOCKED_HOST_FRAGMENTS = [
  "amazon.",
  "ebay.",
  "etsy.",
  "facebook.com",
  "fb.com",
  "instagram.com",
  "tiktok.com",
  "youtube.com",
  "youtu.be",
  "craigslist.",
  "offerup.com",
  "mercari.com",
  "poshmark.com",
  "walmart.",
  "target.com",
  "rei.com",
  "surfline.com",
  "ccs.com",
  "tactics.com",
  "zumiez.com",
  "wikipedia.org",
  "reddit.com",
  "pinterest.",
  "x.com",
  "twitter.com",
  "linkedin.com",
] as const

const PRIVATE_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"])

export function hostnameFromUrl(raw: string): string | null {
  try {
    return new URL(raw).hostname.toLowerCase()
  } catch {
    return null
  }
}

export function isBlockedOfficialSiteHost(host: string | null): boolean {
  if (!host) return true
  const h = host.toLowerCase()
  if (PRIVATE_HOSTS.has(h) || h.endsWith(".local") || h.endsWith(".internal")) return true
  if (h.endsWith(".localhost")) return true
  return BLOCKED_HOST_FRAGMENTS.some((fragment) => h.includes(fragment.replace(/^\./, "")))
}

export function isSafePublicHttpsUrl(raw: string): boolean {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }
  if (url.protocol !== "https:") return false
  const host = url.hostname.toLowerCase()
  if (isBlockedOfficialSiteHost(host)) return false
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) {
    const parts = host.split(".").map((p) => Number(p))
    const [a, b] = parts
    if (a === 10 || a === 127 || a === 0) return false
    if (a === 169 && b === 254) return false
    if (a === 192 && b === 168) return false
    if (a === 172 && b >= 16 && b <= 31) return false
  }
  return true
}

export function officialSiteTextMentionsModel(
  haystack: string,
  modelName: string,
): boolean {
  const foldedHay = haystack
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
  const foldedModel = modelName
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
  if (foldedModel.length < 3) return false
  return ` ${foldedHay} `.includes(` ${foldedModel} `)
}
