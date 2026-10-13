import type {
  EarningsListingRef,
  EarningsTransaction,
} from "@/components/features/earnings/earnings-types"
import {
  isLikelyOrderUuid,
  orderIdFromSellerSaleLedger,
  saleHrefForOrderId,
} from "@/lib/earnings-sale-ledger"

export interface EarningsListingMapRow {
  sellerEarningsUsd: number | null
  listing: EarningsListingRef | null
}

export function applyEarningsListingMap(
  transactions: EarningsTransaction[],
  byOrderId: Map<string, EarningsListingMapRow>,
): EarningsTransaction[] {
  return transactions.map((tx) => {
    const orderId = orderIdFromSellerSaleLedger(tx)
    if (!orderId || !isLikelyOrderUuid(orderId)) return tx
    const match = byOrderId.get(orderId)
    if (!match) {
      return {
        ...tx,
        saleHref: saleHrefForOrderId(orderId),
      }
    }
    const listing: EarningsListingRef | null = match.listing
      ? {
          id: match.listing.id,
          title: match.listing.title,
          href: match.listing.href,
          imageUrl: match.listing.imageUrl,
          extraListingCount: match.listing.extraListingCount,
        }
      : null
    return {
      ...tx,
      listing,
      saleHref: saleHrefForOrderId(orderId),
      sellerEarningsUsd: match.sellerEarningsUsd,
    }
  })
}
