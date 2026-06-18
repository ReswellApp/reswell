const STORAGE_KEY = "reswell:recent-nav-brands"
const MAX_BRANDS = 10

export type RecentNavBrandEntry = {
  slug: string | null
  name: string
  logoUrl: string | null
}

export function pushRecentNavBrand(entry: RecentNavBrandEntry): void {
  if (typeof window === "undefined") return
  const name = entry.name.trim()
  if (!name) return

  const slug = entry.slug?.trim() || null
  const logoUrl = entry.logoUrl?.trim() || null

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const prev = raw ? (JSON.parse(raw) as unknown) : []
    const prior = Array.isArray(prev)
      ? prev.filter(
          (row): row is RecentNavBrandEntry =>
            typeof row === "object" &&
            row != null &&
            typeof (row as RecentNavBrandEntry).name === "string",
        )
      : []

    const nextKey = slug?.toLowerCase() ?? name.toLowerCase()
    const next = [
      { slug, name, logoUrl },
      ...prior.filter((row) => {
        const key = row.slug?.toLowerCase() ?? row.name.toLowerCase()
        return key !== nextKey
      }),
    ].slice(0, MAX_BRANDS)

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* ignore quota / private mode */
  }
}

export function readRecentNavBrands(): RecentNavBrandEntry[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    if (!Array.isArray(parsed)) return []

    return parsed
      .map((row): RecentNavBrandEntry | null => {
        if (typeof row !== "object" || row == null) return null
        const name = typeof row.name === "string" ? row.name.trim() : ""
        if (!name) return null
        return {
          slug: typeof row.slug === "string" ? row.slug.trim() || null : null,
          name,
          logoUrl: typeof row.logoUrl === "string" ? row.logoUrl.trim() || null : null,
        }
      })
      .filter((row): row is RecentNavBrandEntry => row != null)
  } catch {
    return []
  }
}
