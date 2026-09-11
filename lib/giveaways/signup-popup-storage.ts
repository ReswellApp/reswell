const STORAGE_KEY = "rw_giveaway_signup_popup"
const PUBLISH_SKIP_KEY = "rw_giveaway_signup_popup_publish_skip"

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

/** This tab just published — do not stack the "list a board" dialog on the PDP. */
export function skipGiveawaySignupPopupAfterPublish(): void {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.setItem(PUBLISH_SKIP_KEY, "1")
  } catch {
    /* private mode */
  }
}

export function shouldSkipGiveawaySignupPopupAfterPublish(): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.sessionStorage.getItem(PUBLISH_SKIP_KEY) === "1"
  } catch {
    return false
  }
}
