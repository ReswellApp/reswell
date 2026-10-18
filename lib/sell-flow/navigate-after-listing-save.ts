const LISTING_EDIT_RETURN_KEY = "reswell.listing-edit-return"

/**
 * Full document navigation after listing create.
 *
 * Soft `router.push` / `router.replace` after a Server Action that revalidates
 * `/l/[listing]` deadlocks the App Router when that PDP is already in the
 * client cache (the usual edit path: listing → Edit → Save). The save overlay
 * never unmounts and the page appears frozen.
 */
export function navigateAfterListingSave(href: string): void {
  window.location.assign(href)
}

/** `history.length` includes the current entry. More than one means Back has a screen. */
export function listingEditReturnMode(historyLength: number): "back" | "assign" {
  return historyLength > 1 ? "back" : "assign"
}

export function markListingEditReturn(): void {
  try {
    sessionStorage.setItem(LISTING_EDIT_RETURN_KEY, "1")
  } catch {
    /* private mode */
  }
}

/** True once per save. The restored screen uses this to refresh server data. */
export function consumeListingEditReturn(): boolean {
  try {
    if (sessionStorage.getItem(LISTING_EDIT_RETURN_KEY) !== "1") return false
    sessionStorage.removeItem(LISTING_EDIT_RETURN_KEY)
    return true
  } catch {
    return false
  }
}

/**
 * After an edit, go back to the screen the seller opened the form from.
 * Falls back to the listing when this tab has no previous entry.
 */
export function returnToScreenAfterListingEdit(fallbackHref: string): void {
  if (listingEditReturnMode(window.history.length) === "back") {
    markListingEditReturn()
    window.history.back()
    return
  }
  window.location.assign(fallbackHref)
}
