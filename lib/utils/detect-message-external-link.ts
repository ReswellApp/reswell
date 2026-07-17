/**
 * Marketplace policy: detect external URLs in DM text.
 * Reswell on-platform links are allowed so buyers can share listings.
 */

const URL_PATTERN = /https?:\/\/[^\s<>"']+|www\.[^\s<>"']+\.[a-z]{2,}/gi

const ALLOWED_LINK_HOSTS = new Set(["reswell.com", "localhost", "127.0.0.1"])

function normalizeHost(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/^www\./, "")
}

function isAllowedLinkHost(hostname: string): boolean {
  const host = normalizeHost(hostname)
  if (ALLOWED_LINK_HOSTS.has(host)) return true
  return host.endsWith(".reswell.com")
}

function parseUrlHost(token: string): string | null {
  try {
    const normalized = /^www\./i.test(token) ? `https://${token}` : token
    return new URL(normalized).hostname
  } catch {
    return null
  }
}

export function messageContainsExternalLink(text: string): boolean {
  const t = text.trim()
  if (!t) return false

  const matches = t.match(URL_PATTERN)
  if (!matches) return false

  for (const match of matches) {
    const host = parseUrlHost(match)
    if (!host) continue
    if (!isAllowedLinkHost(host)) return true
  }

  return false
}
