import type { EarningsListingRef, EarningsTransaction } from "@/components/features/earnings/earnings-types"
import {
  orderDetailPathFromLedgerTx,
  orderIdFromSellerSaleLedger,
} from "@/lib/earnings-sale-ledger"

function extractSoldItemName(raw: string): string | null {
  const pending = raw.match(/^Pending — Sold "(.+?)"/)
  if (pending) return pending[1]
  const available = raw.match(/^Available — Sold "(.+?)"/)
  if (available) return available[1]
  const sold = raw.match(/^Sold "(.+?)"/)
  return sold ? sold[1] : null
}

export type EarningsBalanceStatus = "pending" | "ready"

export interface EarningsBalanceListingRow {
  key: string
  status: EarningsBalanceStatus
  title: string
  imageUrl: string | null
  listingHref: string | null
  saleHref: string | null
  amountUsd: number
  extraListingCount: number
  createdAt: string
}

export function saleEarningsAmountUsd(tx: EarningsTransaction): number {
  const fromLedger = parseFloat(tx.amount)
  if (Number.isFinite(fromLedger) && fromLedger > 0.0001) return fromLedger
  if (tx.sellerEarningsUsd != null && Number.isFinite(tx.sellerEarningsUsd) && tx.sellerEarningsUsd > 0) {
    return tx.sellerEarningsUsd
  }
  return 0
}

function titleForSaleTx(tx: EarningsTransaction): string {
  const listing = tx.listing
  if (listing?.title) return listing.title
  return extractSoldItemName(tx.description) || "Sale"
}

function toBalanceRow(
  tx: EarningsTransaction,
  status: EarningsBalanceStatus,
  amountUsd: number,
): EarningsBalanceListingRow {
  const listing: EarningsListingRef | null = tx.listing ?? null
  return {
    key: tx.id,
    status,
    title: titleForSaleTx(tx),
    imageUrl: listing?.imageUrl ?? null,
    listingHref: listing?.href ?? null,
    saleHref: tx.saleHref ?? orderDetailPathFromLedgerTx(tx),
    amountUsd,
    extraListingCount: listing?.extraListingCount ?? 0,
    createdAt: tx.created_at,
  }
}

/** Pending sale credits whose order has not unlocked yet. Newest first. */
export function stillPendingBalanceRows(
  pendingTxs: EarningsTransaction[],
  releasedOrderIds: Set<string>,
  reversedOrderIds: Set<string>,
): EarningsBalanceListingRow[] {
  const seen = new Set<string>()
  const rows: EarningsBalanceListingRow[] = []
  const newestFirst = [...pendingTxs].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )
  for (const tx of newestFirst) {
    const orderId = orderIdFromSellerSaleLedger(tx)
    if (!orderId || releasedOrderIds.has(orderId) || reversedOrderIds.has(orderId)) continue
    if (seen.has(orderId)) continue
    seen.add(orderId)
    const amount = saleEarningsAmountUsd(tx)
    if (amount <= 0) continue
    rows.push(toBalanceRow(tx, "pending", amount))
  }
  return rows
}

/**
 * Attribute the current ready balance to the newest unlocked sales first.
 * Older unlocks that have already been spent or cashed out are omitted.
 */
export function allocateReadyBalanceRows(
  releasedTxs: EarningsTransaction[],
  reversedOrderIds: Set<string>,
  readyBalanceUsd: number,
): EarningsBalanceListingRow[] {
  if (!(readyBalanceUsd > 0.009)) return []

  const newestFirst = [...releasedTxs].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )
  const seen = new Set<string>()
  const rows: EarningsBalanceListingRow[] = []
  let remaining = readyBalanceUsd

  for (const tx of newestFirst) {
    if (remaining <= 0.009) break
    const orderId = orderIdFromSellerSaleLedger(tx)
    if (orderId && reversedOrderIds.has(orderId)) continue
    if (orderId) {
      if (seen.has(orderId)) continue
      seen.add(orderId)
    }
    const saleAmount = saleEarningsAmountUsd(tx)
    if (saleAmount <= 0) continue
    const take = Math.min(saleAmount, remaining)
    rows.push(toBalanceRow(tx, "ready", take))
    remaining -= take
  }

  return rows
}
