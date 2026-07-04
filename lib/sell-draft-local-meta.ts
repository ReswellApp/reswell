/**
 * Session-scoped hint for the in-progress server draft listing id (per product section).
 * Cleared on publish, discard, or ?new=1.
 */

import { peerListingEditHref } from "@/lib/peer-listing-sections"

export type SellDraftSection = "surfboards" | "fins"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function storageKey(section: SellDraftSection): string {
  return `reswell.sell.serverDraftListingId.${section}`
}

export function getSellServerDraftListingId(section: SellDraftSection): string | null {
  if (typeof window === "undefined") return null
  try {
    const v = sessionStorage.getItem(storageKey(section))
    if (!v || !UUID_RE.test(v)) return null
    return v
  } catch {
    return null
  }
}

export function setSellServerDraftListingId(section: SellDraftSection, id: string): void {
  if (typeof window === "undefined") return
  if (!UUID_RE.test(id)) return
  try {
    sessionStorage.setItem(storageKey(section), id)
  } catch {
    /* quota / private mode */
  }
}

export function clearSellServerDraftListingId(section: SellDraftSection): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem(storageKey(section))
  } catch {
    /* ignore */
  }
}

/** Updates the address bar to `?edit=` without a Next.js navigation (avoids reload flash after save). */
export function replaceSellDraftEditUrl(section: SellDraftSection, listingId: string): void {
  if (typeof window === "undefined") return
  if (!UUID_RE.test(listingId)) return
  try {
    window.history.replaceState(null, "", peerListingEditHref(section, listingId))
  } catch {
    /* ignore */
  }
}
