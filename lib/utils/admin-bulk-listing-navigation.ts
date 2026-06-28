import { toast } from "sonner"

type RouterLike = {
  push: (href: string) => void
}
import {
  completeBulkListingSlot,
  getNextPendingBulkSlot,
  loadBulkListingSession,
  markBulkListingSlotInProgress,
} from "@/lib/admin-bulk-listing-session"
import {
  peerSellCreateHref,
  PEER_LISTING_SECTION_LABELS,
  type PeerListingSection,
} from "@/lib/peer-listing-sections"

/** Returns true when navigation was handled by bulk-listing flow. */
export function resolveAdminBulkListingAfterCreate(
  router: RouterLike,
  params: {
    bulkSlotId: string | null | undefined
    listingId: string
    slug: string
    title: string
    section: PeerListingSection
    defaultDetailPath: string
    successMessage?: string
  },
): boolean {
  if (!params.bulkSlotId) return false

  const session = loadBulkListingSession()
  if (!session) return false

  const updated = completeBulkListingSlot(session, params.bulkSlotId, {
    listingId: params.listingId,
    listingSlug: params.slug,
    title: params.title,
  })
  if (!updated) return false

  const next = getNextPendingBulkSlot(updated)
  if (next) {
    markBulkListingSlotInProgress(updated, next.id)
    toast.success(
      params.successMessage ??
        `Listing published (${updated.slots.filter((s) => s.status === "completed").length}/${updated.slots.length}). Next: ${PEER_LISTING_SECTION_LABELS[next.section]}`,
    )
    router.push(peerSellCreateHref(next.section, next.id))
    return true
  }

  toast.success(`All ${updated.slots.length} bulk listings are live.`)
  router.push("/admin/listings/bulk?done=1")
  return true
}
