/** Extract a listing slug or UUID from a pasted `/l/…` URL, path, or raw id. */
export function parseBlogListingRef(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const fromPath = (pathname: string): string | null => {
    const match = pathname.match(/\/l\/([^/?#]+)/i)
    if (!match?.[1]) return null
    try {
      const decoded = decodeURIComponent(match[1]).trim()
      return decoded || null
    } catch {
      return match[1].trim() || null
    }
  }

  try {
    const url = new URL(trimmed)
    const fromUrl = fromPath(url.pathname)
    if (fromUrl) return fromUrl
  } catch {
    const fromRelative = fromPath(trimmed.startsWith("/") ? trimmed : `/${trimmed}`)
    if (fromRelative) return fromRelative
  }

  if (/\s/.test(trimmed) || trimmed.length > 200) return null
  return trimmed
}
