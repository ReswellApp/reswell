/**
 * Parses `/sell` query params for Klaviyo sell-abandonment segmentation.
 */

export type SellPageViewMode = "new" | "edit" | "landing"

export type SellPageViewContext = {
  mode: SellPageViewMode
  /** Present when `?edit=<uuid>` */
  editListingId: string | null
  /** `draft` | `active` | other listing.status when edit id was resolved server-side */
  editListingStatus: string | null
}

export function sellPageViewContextFromPath(
  pathname: string,
  search: string | undefined,
): SellPageViewContext | null {
  const p = pathname.trim()
  if (p !== "/sell" && !p.startsWith("/sell/")) return null

  const raw = typeof search === "string" ? search.trim() : ""
  const q = raw.startsWith("?") ? raw.slice(1) : raw
  const params = new URLSearchParams(q)

  const editRaw = params.get("edit")?.trim() ?? ""
  const editListingId = editRaw.length > 0 ? editRaw : null

  if (params.get("new") === "1") {
    return { mode: "new", editListingId, editListingStatus: null }
  }
  if (editListingId) {
    return { mode: "edit", editListingId, editListingStatus: null }
  }
  return { mode: "landing", editListingId: null, editListingStatus: null }
}
