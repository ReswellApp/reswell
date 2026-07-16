import type { SellFlowListingKind } from "@/lib/sell-flow/session-keys"
import {
  buildSellListingDraft,
  saveGuestSellListingDraft,
  saveSellListingDraft,
  clearGuestSellListingDraft,
  clearSellListingDraft,
  type SellListingDraftFormSnapshot,
} from "@/lib/sell-listing-draft-idb"
import {
  listingPhotoSlotsForDraftPersist,
  type ListingPhotoSlot,
} from "@/lib/sell-flow/listing-photo-slot"

export async function persistListingDraftSnapshot(args: {
  listingType: SellFlowListingKind
  formData: SellListingDraftFormSnapshot
  images: ListingPhotoSlot[]
  userId: string | null
}): Promise<void> {
  const built = await buildSellListingDraft(
    args.listingType,
    args.formData,
    listingPhotoSlotsForDraftPersist(args.images),
    null,
    args.userId,
    { allowGuest: !args.userId },
  )
  if (built) {
    if (args.userId) await saveSellListingDraft(built)
    else await saveGuestSellListingDraft(built)
    return
  }
  if (args.userId) await clearSellListingDraft(args.userId, args.listingType)
  else await clearGuestSellListingDraft(args.listingType)
}
