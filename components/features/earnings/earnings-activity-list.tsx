"use client"

import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  Clock,
  DollarSign,
  Loader2,
  RotateCcw,
} from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { EarningsActivityStatusFilter, EarningsTransaction } from "./earnings-types"
import {
  activityEmptyFilterCopy,
  buildSalePendingReleasePairs,
  dayKeyLocal,
  extractSoldItemName,
  formatActivityDayLabel,
  omitReversedSaleCreditRow,
  orderIdFromSellerSaleLedgerTx,
  parseDescription,
  singleRowVisualKind,
  txRowMatchesStatusFilter,
  type ActivityTxRow,
  type ActivityVisualKind,
} from "./earnings-activity-helpers"

/** Monochrome icon tile — no semantic colors. */
const iconSurfaceClass =
  "bg-muted text-foreground ring-1 ring-border/80 dark:bg-muted dark:text-foreground dark:ring-border"

const statusPillClass =
  "inline-flex items-center gap-1 rounded-md border border-border bg-background px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-foreground"

/**
 * Formats like `$1,234.56`, with consistent two-digit minor units. Keeps the dollar sign glued so it reads as money
 * rather than “sign then number”.
 */
function formatMoney(n: number): string {
  return `$${Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/**
 * Primary label for a row. Replaces generic “Admin seed” -> “Admin seed” (unchanged) but trims the prefix pills out of
 * the title when we already render a pill. Falls back to the raw description if parsing fails.
 */
function titleForSingleRow(t: EarningsTransaction): string {
  const { title } = parseDescription(t.description, t.type)
  return (
    title
      .replace(/^Pending — /, "")
      .replace(/^Available — /, "")
      .replace(/^Refund — /, "")
      .replace(/^Sold — /, "")
      .replace(/^Purchased — /, "")
      .replace(/^Payout — /, "") || title
  )
}

function kindLabel(kind: ActivityVisualKind, tType: string): string {
  if (kind === "available") return "Ready"
  if (kind === "pending") return "Pending"
  if (kind === "refund") return "Refund"
  if (tType === "cashout") return "Payout"
  if (tType === "purchase") return "Purchase"
  if (tType === "sale") return "Sale"
  if (tType === "deposit") return "Deposit"
  return "Activity"
}

function formatTimeOnly(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })
}

export function EarningsActivityList({
  transactions,
  statusFilter,
  reversedOrderIds,
  isLoadingMore,
  hasMore,
  onLoadMore,
  pageSize,
  globalEmptyCopy,
  onCollapseLoadedActivity,
}: {
  transactions: EarningsTransaction[]
  statusFilter: EarningsActivityStatusFilter
  reversedOrderIds: Set<string>
  isLoadingMore: boolean
  hasMore: boolean
  onLoadMore: () => void
  pageSize: number
  globalEmptyCopy?: { title: string; body: string }
  onCollapseLoadedActivity?: () => void
}) {
  if (transactions.length === 0) {
    const empty = globalEmptyCopy ?? {
      title: "No activity yet",
      body: "Sales, purchases, payouts, and refunds will appear here in order—newest first.",
    }
    return (
      <Card className="border-dashed border-border/80 bg-muted/20 shadow-none">
        <CardContent className="p-10 text-center max-w-lg mx-auto">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-background ring-1 ring-border">
            <DollarSign className="h-5 w-5 text-muted-foreground" aria-hidden />
          </div>
          <p className="font-semibold text-foreground">{empty.title}</p>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{empty.body}</p>
        </CardContent>
      </Card>
    )
  }

  const { pendingSkip, mergeByReleaseId } = buildSalePendingReleasePairs(transactions)

  const txRows: ActivityTxRow[] = []
  for (const t of transactions) {
    if (pendingSkip.has(t.id)) continue
    const merged = mergeByReleaseId.get(t.id)
    if (merged) {
      const oid =
        orderIdFromSellerSaleLedgerTx(merged.pending) ?? orderIdFromSellerSaleLedgerTx(merged.release)
      if (oid && reversedOrderIds.has(oid)) continue
      txRows.push({
        kind: "merged",
        key: merged.release.id,
        pending: merged.pending,
        release: merged.release,
      })
    } else {
      if (omitReversedSaleCreditRow(t, reversedOrderIds)) continue
      txRows.push({ kind: "single", key: t.id, t })
    }
  }

  const filteredTxRows = txRows.filter((r) => txRowMatchesStatusFilter(r, statusFilter, reversedOrderIds))

  const canCollapseLoaded =
    Boolean(onCollapseLoadedActivity) && transactions.length > pageSize

  if (filteredTxRows.length === 0) {
    const copy = activityEmptyFilterCopy(statusFilter)
    return (
      <Card className="border-dashed border-border/80 bg-muted/20 shadow-none">
        <CardContent className="p-10 text-center max-w-md mx-auto">
          <p className="font-semibold text-foreground">{copy.title}</p>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{copy.body}</p>
          {statusFilter !== "all" && (
            <p className="text-xs text-muted-foreground mt-3">
              Tip: switch to <span className="text-foreground font-medium">All</span> to see everything.
            </p>
          )}
        </CardContent>
      </Card>
    )
  }

  type ActivityRow =
    | { kind: "date"; key: string; label: string }
    | { kind: "merged"; key: string; pending: EarningsTransaction; release: EarningsTransaction }
    | { kind: "single"; key: string; t: EarningsTransaction }

  const rows: ActivityRow[] = []
  let lastDayKey: string | null = null
  for (const tr of filteredTxRows) {
    const createdAt = tr.kind === "merged" ? tr.release.created_at : tr.t.created_at
    const dk = dayKeyLocal(createdAt)
    if (dk !== lastDayKey) {
      lastDayKey = dk
      rows.push({ kind: "date", key: `date-${dk}`, label: formatActivityDayLabel(createdAt) })
    }
    rows.push(tr)
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        <Card className="overflow-hidden border-border/80 shadow-sm">
          <CardContent className="p-0">
            <ul className="divide-y divide-border/60" role="list">
              {rows.map((row) => {
                if (row.kind === "date") {
                  return (
                    <li
                      key={row.key}
                      className="sticky top-0 z-[1] bg-background/95 supports-[backdrop-filter]:bg-background/80 backdrop-blur px-4 py-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground border-b border-border/60"
                    >
                      {row.label}
                    </li>
                  )
                }

                if (row.kind === "merged") {
                  const { pending, release } = row
                  const amt = parseFloat(pending.amount)
                  const parsedPending = parseDescription(pending.description, pending.type)
                  const item =
                    extractSoldItemName(pending.description) ??
                    parsedPending.title.replace(/^Pending — /, "").replace(/^Available — /, "")
                  const balAfter = Number.isFinite(parseFloat(release.balance_after))
                    ? parseFloat(release.balance_after)
                    : 0
                  const time = formatTimeOnly(release.created_at)
                  return (
                    <li key={row.key}>
                      <div className="group flex items-center gap-4 px-4 py-3.5 hover:bg-muted/30 transition-colors">
                        <div
                          aria-hidden
                          className={cn(
                            "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
                            iconSurfaceClass,
                          )}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0 py-0.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{item}</p>
                            <span className={statusPillClass}>Ready</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                            <span>Sale cleared</span>
                            <span className="mx-1.5 text-border" aria-hidden>·</span>
                            <span>{time}</span>
                          </p>
                        </div>
                        <div className="text-right shrink-0 min-w-[6rem] pl-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                className={cn(
                                  "block w-full text-sm font-semibold tabular-nums text-foreground rounded-md px-1 -mx-1 py-0.5 hover:bg-background cursor-help text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                )}
                              >
                                +{formatMoney(amt)}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="text-xs max-w-[17rem] leading-snug">
                              Your ready balance after this sale unlocked was {formatMoney(balAfter)}.
                            </TooltipContent>
                          </Tooltip>
                          <p className="text-[10.5px] text-muted-foreground tabular-nums mt-0.5">
                            Bal {formatMoney(balAfter)}
                          </p>
                        </div>
                      </div>
                    </li>
                  )
                }

                const t = row.t
                const amt = parseFloat(t.amount)
                const isRelease =
                  t.description.startsWith("Available — ") && Math.abs(amt) < 0.0001
                const incoming = amt > 0.0001
                const balAfter = Number.isFinite(parseFloat(t.balance_after))
                  ? parseFloat(t.balance_after)
                  : 0
                const visualKind = singleRowVisualKind(t, titleForSingleRow(t), reversedOrderIds)
                const label = kindLabel(visualKind, t.type)
                const title = titleForSingleRow(t)
                const time = formatTimeOnly(t.created_at)
                const statusNote = t.status && t.status !== "completed" ? t.status : ""
                const Icon =
                  visualKind === "available"
                    ? CheckCircle2
                    : visualKind === "pending"
                      ? Clock
                      : visualKind === "refund"
                        ? RotateCcw
                        : t.type === "cashout"
                          ? Banknote
                          : incoming
                            ? ArrowDownLeft
                            : ArrowUpRight
                return (
                  <li key={row.key}>
                    <div className="group flex items-center gap-4 px-4 py-3.5 hover:bg-muted/30 transition-colors">
                      <div
                        aria-hidden
                        className={cn(
                          "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
                          iconSurfaceClass,
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0 py-0.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{title}</p>
                          <span className={statusPillClass}>{label}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                          <span>{time}</span>
                          {statusNote ? (
                            <>
                              <span className="mx-1.5 text-border" aria-hidden>·</span>
                              <span className="capitalize">{statusNote}</span>
                            </>
                          ) : null}
                        </p>
                      </div>
                      <div className="text-right shrink-0 min-w-[6rem] pl-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className={cn(
                                "block w-full text-sm font-semibold tabular-nums rounded-md px-1 -mx-1 py-0.5 hover:bg-background cursor-help text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                isRelease ? "text-muted-foreground" : "text-foreground",
                              )}
                            >
                              {isRelease ? (
                                <span className="font-medium">Unlocked</span>
                              ) : (
                                <>
                                  {incoming ? "+" : "−"}
                                  {formatMoney(amt)}
                                </>
                              )}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="text-xs max-w-[17rem] leading-snug">
                            {isRelease
                              ? "Pending earnings moved into your ready balance (no extra dollar amount on this line)."
                              : `Your ready balance after this line posted was ${formatMoney(balAfter)}.`}
                          </TooltipContent>
                        </Tooltip>
                        <p className="text-[10.5px] text-muted-foreground tabular-nums mt-0.5">
                          Bal {formatMoney(balAfter)}
                        </p>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-1">
          <p className="text-xs text-muted-foreground">
            Showing <span className="font-medium text-foreground tabular-nums">{filteredTxRows.length}</span>{" "}
            {filteredTxRows.length === 1 ? "row" : "rows"}
            {!hasMore ? <span> · End of history</span> : null}
          </p>
          <div className="flex flex-wrap items-center gap-2 justify-end">
            {canCollapseLoaded ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => onCollapseLoadedActivity?.()}
              >
                Close section
              </Button>
            ) : null}
            {hasMore ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isLoadingMore}
                onClick={() => onLoadMore()}
                className="min-w-[9rem]"
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden />
                    Loading…
                  </>
                ) : (
                  `Load ${pageSize} more`
                )}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
