/**
 * Normalizes Instagram post / reel URLs to the official iframe embed endpoint.
 */
export function instagramPermalinkToEmbedSrc(permalink: string): string | null {
  const raw = permalink.trim()
  if (!raw) return null

  try {
    const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    const u = new URL(normalized)

    let host = u.hostname.toLowerCase()
    if (host.startsWith("www.")) host = host.slice(4)
    if (host !== "instagram.com") return null

    const pathname = u.pathname.replace(/\/+/g, "/")
    let kind: string
    let code: string | undefined

    const classic = pathname.match(/\/(p|reel|tv)\/([^/?#]+)/)
    if (classic?.[1] && classic[2]) {
      kind = classic[1] === "reel" ? "reel" : classic[1]
      code = classic[2]
    } else {
      const reelsStory = pathname.match(/\/([^/]+)\/reels?\/([^/?#]+)/i)
      code = reelsStory?.[2]
      kind = code ? "reel" : ""
    }

    if (!code?.trim()) return null
    if (kind === "tv") {
      return `https://www.instagram.com/tv/${code}/embed`
    }
    const segment = kind === "p" ? "p" : "reel"
    return `https://www.instagram.com/${segment}/${code}/embed`
  } catch {
    return null
  }
}
