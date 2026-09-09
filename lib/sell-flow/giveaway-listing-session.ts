const SESSION_KEY = "reswell.sell.giveawayListing"

/** Stamp that this tab is listing from a giveaway CTA (`from=giveaway`). */
export function markGiveawayListingSession(): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(SESSION_KEY, "1")
  } catch {
    /* private mode */
  }
}

/** True when this tab entered /sell from a giveaway (survives `?from=` being stripped). */
export function isGiveawayListingSession(): boolean {
  if (typeof window === "undefined") return false
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1"
  } catch {
    return false
  }
}
