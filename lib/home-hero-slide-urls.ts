/**
 * Homepage hero: static files in /public/images/home/ vs rows in `public.images`.
 * If we always concat defaults + DB, deleting a DB row whose `url` matches a default
 * (e.g. /images/home/hero-slide-2.png) leaves that slide in the rotation from the fallback list.
 *
 * When the table has at least one hero image row, the slideshow uses **only** those URLs
 * (in DB order). When empty, the eight static fallbacks are used.
 */

/** Static homepage hero backdrop (replaces the rotating slideshow). */
export const HOME_HERO_BACKDROP_PATH = "/images/home/hero-backdrop-tahiti.jpg"

/** Default hero art when there are no recent listing images to show. */
export const FALLBACK_HOME_HERO_SLIDE_PATHS = [
  "/images/home/hero-slide-1.png",
  "/images/home/hero-slide-2.png",
  "/images/home/hero-slide-3.png",
  "/images/home/hero-slide-4.png",
  "/images/home/hero-slide-5.png",
  "/images/home/hero-slide-6.png",
  "/images/home/hero-slide-7.png",
  "/images/home/hero-slide-8.png",
] as const

export function normalizeHeroSlideUrl(u: string): string {
  const s = u.trim()
  if (!s) return s
  const [path] = s.split("?")
  return path || s
}

function dedupeByNormalizedUrl(urls: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const u of urls) {
    const k = normalizeHeroSlideUrl(u)
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(u.trim())
  }
  return out
}

export function buildHomeHeroSlideUrls(
  dbUrls: string[],
  fallbacks: readonly string[],
): string[] {
  if (dbUrls.length === 0) {
    return [...fallbacks]
  }
  return dedupeByNormalizedUrl(dbUrls)
}
