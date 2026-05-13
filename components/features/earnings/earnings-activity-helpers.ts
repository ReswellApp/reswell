import { cn } from "@/lib/utils"
import type { EarningsActivityStatusFilter, EarningsTransaction } from "./earnings-types"

const ORDER_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isLikelyOrderUuid(id: string): boolean {
  return ORDER_UUID_RE.test(id.trim())
}

/** Dashboard order detail when `reference_id` is the marketplace order id. */
export function orderDetailPathFromTx(t: EarningsTransaction): string | null {
  const rid = typeof t.reference_id === "string" ? t.reference_id.trim() : ""
  if (!rid || !isLikelyOrderUuid(rid)) return null
  const rt = t.reference_type ?? ""
  if (
    rt === "order_pending_earnings" ||
    rt === "order_seller_earnings" ||
    rt === "wallet_refund"
  ) {
    return `/dashboard/purchases/${rid}`
  }
  return null
}

export function orderIdFromSellerSaleLedgerTx(t: EarningsTransaction): string | null {
  const rt = t.reference_type
  if (rt === "order_pending_earnings" || rt === "order_seller_earnings") {
    const rid = typeof t.reference_id === "string" ? t.reference_id.trim() : ""
    return rid || null
  }
  return null
}

export function omitReversedSaleCreditRow(
  t: EarningsTransaction,
  reversedOrderIds: Set<string>,
): boolean {
  if (t.type === "refund") return false
  const oid = orderIdFromSellerSaleLedgerTx(t)
  return Boolean(oid && reversedOrderIds.has(oid))
}

export function extractSoldItemName(raw: string): string | null {
  const p = raw.match(/^Pending — Sold "(.+?)"/)
  if (p) return p[1]
  const a = raw.match(/^Available — Sold "(.+?)"/)
  if (a) return a[1]
  const s = raw.match(/^Sold "(.+?)"/)
  return s ? s[1] : null
}

export function txTime(iso: string): number {
  return new Date(iso).getTime()
}

export function dayKeyLocal(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function formatActivityDayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

export function formatActivityShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function buildSalePendingReleasePairs(transactions: EarningsTransaction[]) {
  const isAvailableRelease = (t: EarningsTransaction) =>
    t.description.startsWith('Available — Sold "') && Math.abs(parseFloat(t.amount)) < 1e-6

  const isPendingSale = (t: EarningsTransaction) =>
    t.description.startsWith('Pending — Sold "') && parseFloat(t.amount) > 1e-6

  const releases = transactions.filter(isAvailableRelease)
  const pendings = transactions.filter(isPendingSale)
  const usedPending = new Set<string>()
  const mergeByReleaseId = new Map<string, { pending: EarningsTransaction; release: EarningsTransaction }>()

  const sortedReleases = [...releases].sort((a, b) => txTime(b.created_at) - txTime(a.created_at))

  for (const r of sortedReleases) {
    const title = extractSoldItemName(r.description)
    if (!title) continue
    const candidates = pendings.filter((p) => {
      if (usedPending.has(p.id)) return false
      if (extractSoldItemName(p.description) !== title) return false
      return txTime(p.created_at) <= txTime(r.created_at)
    })
    if (candidates.length === 0) continue
    const pending = candidates.reduce((a, b) =>
      txTime(b.created_at) > txTime(a.created_at) ? b : a,
    )
    usedPending.add(pending.id)
    mergeByReleaseId.set(r.id, { pending, release: r })
  }

  return { pendingSkip: usedPending, mergeByReleaseId }
}

const activityPillBase =
  "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide border tabular-nums"

export function activityPillClassForBadge(badge: string | null): string {
  if (!badge) {
    return cn(activityPillBase, "border-border/70 bg-muted/40 text-foreground")
  }
  const u = badge.toLowerCase()
  if (u === "pending") {
    return cn(
      activityPillBase,
      "border-amber-200/90 bg-amber-50 text-amber-950 dark:border-amber-800/70 dark:bg-amber-950/40 dark:text-amber-50",
    )
  }
  if (u === "ready") {
    return cn(
      activityPillBase,
      "border-emerald-200/90 bg-emerald-50 text-emerald-950 dark:border-emerald-800/70 dark:bg-emerald-950/40 dark:text-emerald-50",
    )
  }
  if (u === "refunded" || u === "refund") {
    return cn(
      activityPillBase,
      "border-rose-200/90 bg-rose-50 text-rose-950 dark:border-rose-800/70 dark:bg-rose-950/40 dark:text-rose-50",
    )
  }
  if (u === "sale") {
    return cn(activityPillBase, "border-border/70 bg-muted/30 text-foreground")
  }
  if (u === "purchase") {
    return cn(
      activityPillBase,
      "border-sky-200/90 bg-sky-50 text-sky-950 dark:border-sky-800/70 dark:bg-sky-950/40 dark:text-sky-50",
    )
  }
  if (u === "payout") {
    return cn(
      activityPillBase,
      "border-violet-200/90 bg-violet-50 text-violet-950 dark:border-violet-800/70 dark:bg-violet-950/40 dark:text-violet-50",
    )
  }
  return cn(activityPillBase, "border-border/70 bg-background text-foreground")
}

export function activityMetaFromTitle(title: string): {
  badge: string | null
  headline: string
  badgeClass: string
} {
  if (title.startsWith("Pending — ")) {
    return {
      badge: "Pending",
      headline: title.slice("Pending — ".length),
      badgeClass: activityPillClassForBadge("Pending"),
    }
  }
  if (title.startsWith("Available — ")) {
    return {
      badge: "Ready",
      headline: title.slice("Available — ".length),
      badgeClass: activityPillClassForBadge("Ready"),
    }
  }
  if (title.startsWith("Refund — ")) {
    return {
      badge: "Refund",
      headline: title.slice("Refund — ".length),
      badgeClass: activityPillClassForBadge("Refund"),
    }
  }
  if (title.startsWith("Sold — ")) {
    return {
      badge: "Sale",
      headline: title.slice("Sold — ".length),
      badgeClass: activityPillClassForBadge("Sale"),
    }
  }
  if (title.startsWith("Purchased — ")) {
    return {
      badge: "Purchase",
      headline: title.slice("Purchased — ".length),
      badgeClass: activityPillClassForBadge("Purchase"),
    }
  }
  if (title.startsWith("Payout — ")) {
    return {
      badge: "Payout",
      headline: title.slice("Payout — ".length),
      badgeClass: activityPillClassForBadge("Payout"),
    }
  }
  return { badge: null, headline: title, badgeClass: activityPillClassForBadge(null) }
}

export type ActivityVisualKind = "available" | "pending" | "refund" | "neutral"

export function singleRowVisualKind(
  t: EarningsTransaction,
  parsedTitle: string,
  reversedOrderIds: Set<string>,
): ActivityVisualKind {
  if (t.type === "refund" || parsedTitle.startsWith("Refund — ")) return "refund"
  const saleOrderId = orderIdFromSellerSaleLedgerTx(t)
  if (saleOrderId && reversedOrderIds.has(saleOrderId)) return "refund"
  const amt = parseFloat(t.amount)
  const isRelease =
    t.description.startsWith("Available — ") && Math.abs(amt) < 0.0001
  if (isRelease || parsedTitle.startsWith("Available — ")) return "available"
  if (parsedTitle.startsWith("Pending — ") || t.description.startsWith("Pending — Sold")) {
    return "pending"
  }
  return "neutral"
}

export const activityRowSurfaceNeutral =
  "hover:bg-muted/35 border-l-2 border-l-transparent hover:border-l-border/80"

export function parseDescription(raw: string, type: string): { title: string; subtitle: string } {
  if (raw.startsWith("Pending — ")) {
    const m = raw.match(/^Pending — Sold "(.+?)"\s*/)
    if (m) {
      return {
        title: `Pending — ${m[1]}`,
        subtitle: "Waiting on delivery or pickup—then this becomes ready in your balance.",
      }
    }
  }
  if (raw.startsWith("Available — ")) {
    const m = raw.match(/^Available — Sold "(.+?)"\s*/)
    if (m) {
      return {
        title: `Available — ${m[1]}`,
        subtitle: "Unlocked—use it to shop on Reswell or send a payout.",
      }
    }
  }

  const soldMatch = raw.match(/^Sold "(.+?)"\s*(?:\(([^)]+)\))?$/)
  if (soldMatch) {
    const itemName = soldMatch[1]
    const detail = soldMatch[2] ?? ""
    const isCard = /card/i.test(detail)
    const feeMatch = detail.match(/(\d+(?:\.\d+)?)%/)
    const feePct = feeMatch ? `${feeMatch[1]}% marketplace fee` : null
    const parts = [
      isCard ? "Paid by card" : null,
      feePct,
    ].filter(Boolean).join(" · ")
    return { title: `Sold — ${itemName}`, subtitle: parts || "Sale recorded" }
  }

  const buyerRefundMatch = raw.match(/^Refund — "(.+?)"\s*\(\$[\d.]+\s+returned to your balance\)/)
  if (buyerRefundMatch) {
    return {
      title: `Refund — ${buyerRefundMatch[1]}`,
      subtitle: "We returned this to your balance from a refunded order.",
    }
  }

  const refundMatch = raw.match(/^Refund — "(.+?)"/)
  if (refundMatch) {
    const itemName = refundMatch[1]
    const isWallet = /Reswell Bucks|wallet;/i.test(raw)
    const isPending = /pending earnings/i.test(raw)
    const subtitle = isWallet
      ? "Wallet order refunded—your earnings for this listing were reduced."
      : isPending
        ? "Buyer refunded—deducted from pending earnings for this order."
        : "Buyer refunded—deducted from your ready balance for this card order."
    return { title: `Refund — ${itemName}`, subtitle }
  }

  const purchasedMatch = raw.match(/^Purchased "(.+?)"(.*)$/)
  if (purchasedMatch) {
    const itemName = purchasedMatch[1]
    const rest = purchasedMatch[2].trim()
    return { title: `Purchased — ${itemName}`, subtitle: rest.replace(/^\(|\)$/g, "").trim() }
  }

  const cashoutStripe = raw.match(/^Cash-out \$[\d.]+ via bank/i)
  if (cashoutStripe) {
    return {
      title: "Payout — Bank transfer (ACH)",
      subtitle: "Sent from your ready balance.",
    }
  }
  const cashoutMatch = raw.match(/^Cash-out \$[\d.]+ via (\w+)/i)
  if (cashoutMatch) {
    const method = cashoutMatch[1].charAt(0).toUpperCase() + cashoutMatch[1].slice(1)
    const label = method === "Paypal" ? "PayPal" : method
    return {
      title: `Payout — ${label}`,
      subtitle: "Sent from your ready balance.",
    }
  }

  const typeLabel: Record<string, string> = {
    sale: "Sale",
    purchase: "Purchase",
    cashout: "Payout",
    deposit: "Deposit",
    refund: "Refund",
  }
  return { title: raw || typeLabel[type] || type, subtitle: "" }
}

export type ActivityTxRow =
  | { kind: "merged"; key: string; pending: EarningsTransaction; release: EarningsTransaction }
  | { kind: "single"; key: string; t: EarningsTransaction }

export function activityEmptyFilterCopy(filter: EarningsActivityStatusFilter): { title: string; body: string } {
  switch (filter) {
    case "available":
      return {
        title: "Nothing is “ready to use” yet",
        body: "Sales stay pending until delivery or pickup wraps up. Try “Pending” or “All”, or check back after the buyer confirms.",
      }
    case "pending":
      return {
        title: "No pending sales",
        body: "When someone pays you, the sale will sit here until it unlocks.",
      }
    case "refund":
      return {
        title: "No refunds in this slice",
        body: "When a buyer is refunded, deductions from your pending or ready balance appear here.",
      }
    case "cashout":
      return {
        title: "No payouts yet",
        body: "Withdrawals from your ready balance show up here.",
      }
    default:
      return { title: "Nothing to show", body: "" }
  }
}

export function txRowVisualKind(row: ActivityTxRow, reversedOrderIds: Set<string>): ActivityVisualKind {
  if (row.kind === "merged") {
    return "available"
  }
  const { title } = parseDescription(row.t.description, row.t.type)
  return singleRowVisualKind(row.t, title, reversedOrderIds)
}

export function txRowMatchesStatusFilter(
  row: ActivityTxRow,
  filter: EarningsActivityStatusFilter,
  reversedOrderIds: Set<string>,
): boolean {
  if (filter === "all") return true
  if (filter === "cashout") {
    if (row.kind === "merged") return false
    return row.t.type === "cashout"
  }
  return txRowVisualKind(row, reversedOrderIds) === filter
}

export const activityIconCircleClass =
  "h-9 w-9 rounded-full flex items-center justify-center shrink-0 bg-muted text-muted-foreground ring-1 ring-border/70"
