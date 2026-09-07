const STORAGE_KEY = "rw_giveaway_marquee_dismissed"

export function hasDismissedGiveawayMarquee(slug: string): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === slug
  } catch {
    return false
  }
}

export function dismissGiveawayMarquee(slug: string): void {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.setItem(STORAGE_KEY, slug)
  } catch {
    /* private mode */
  }
}
