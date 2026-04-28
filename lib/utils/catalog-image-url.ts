/** Strip cache-busters for deduping the same storage object. */
export function catalogImageDedupeKey(url: string): string {
  const t = url.trim()
  if (!t) return ""
  try {
    const u = new URL(t)
    u.search = ""
    u.hash = ""
    return u.toString()
  } catch {
    return t
  }
}
