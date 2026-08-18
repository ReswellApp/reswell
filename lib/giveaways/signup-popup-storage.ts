const STORAGE_KEY = "rw_giveaway_signup_popup"

export function hasDismissedGiveawaySignupPopup(): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "dismissed"
  } catch {
    return false
  }
}

export function dismissGiveawaySignupPopup(): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, "dismissed")
  } catch {
    /* private mode */
  }
}
