import { parseOrderPlacedMessageMetadata } from '@/lib/validations/order-placed-message-metadata'

export interface ThreadMessageForListingResolve {
  offer_id?: string | null
  metadata?: unknown | null
}

export interface OfferRowListingRef {
  listing_id?: string
}

/**
 * Walks the thread oldest → newest and returns the last listing id referenced
 * by offers or order-placed metadata. Falls back to `fallbackListingId`.
 */
export function resolveThreadPrimaryListingId(
  orderedMessagesOldestFirst: ThreadMessageForListingResolve[],
  offersById: Record<string, OfferRowListingRef>,
  fallbackListingId: string | null,
): string | null {
  let id: string | null = fallbackListingId ?? null

  for (const m of orderedMessagesOldestFirst) {
    if (m.offer_id) {
      const lid = offersById[m.offer_id]?.listing_id
      if (lid) id = lid
      continue
    }
    const placed = parseOrderPlacedMessageMetadata(m.metadata)
    const ids = placed?.listingIds
    if (ids?.length) {
      id = ids[ids.length - 1]!
    }
  }

  return id
}
