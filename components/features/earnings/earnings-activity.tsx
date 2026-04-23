"use client"

import { useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { cn } from "@/lib/utils"
import { EARNINGS_ACTIVITY_PAGE_SIZE } from "@/lib/earnings-activity-page-size"
import type { EarningsActivityStatusFilter, EarningsTransaction } from "./earnings-types"
import { EarningsActivityList } from "./earnings-activity-list"
import {
  buildSalePendingReleasePairs,
  omitReversedSaleCreditRow,
  orderIdFromSellerSaleLedgerTx,
  txRowMatchesStatusFilter,
  type ActivityTxRow,
} from "./earnings-activity-helpers"

export function EarningsActivitySkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-9 w-full max-w-lg" />
      <Card className="shadow-sm">
        <CardContent className="p-0 divide-y divide-border/60">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3.5">
              <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2 py-0.5">
                <Skeleton className="h-4 w-[55%] max-w-xs" />
                <Skeleton className="h-3 w-[30%] max-w-[12rem]" />
              </div>
              <div className="space-y-2 shrink-0 text-right">
                <Skeleton className="h-4 w-20 ml-auto" />
                <Skeleton className="h-3 w-16 ml-auto" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

type FilterOption = { value: EarningsActivityStatusFilter; label: string }
const FILTERS: FilterOption[] = [
  { value: "all", label: "All" },
  { value: "available", label: "Ready" },
  { value: "pending", label: "Pending" },
  { value: "refund", label: "Refunds" },
  { value: "cashout", label: "Payouts" },
]

/**
 * Counts rows that would show under each filter so we can render count badges next to the segments.
 * Uses the same merging logic as the list so the number never disagrees with what the user sees.
 */
function useFilterCounts(
  transactions: EarningsTransaction[],
  reversedOrderIds: Set<string>,
): Record<EarningsActivityStatusFilter, number> {
  return useMemo(() => {
    const { pendingSkip, mergeByReleaseId } = buildSalePendingReleasePairs(transactions)
    const rows: ActivityTxRow[] = []
    for (const t of transactions) {
      if (pendingSkip.has(t.id)) continue
      const merged = mergeByReleaseId.get(t.id)
      if (merged) {
        const oid =
          orderIdFromSellerSaleLedgerTx(merged.pending) ?? orderIdFromSellerSaleLedgerTx(merged.release)
        if (oid && reversedOrderIds.has(oid)) continue
        rows.push({ kind: "merged", key: merged.release.id, pending: merged.pending, release: merged.release })
      } else {
        if (omitReversedSaleCreditRow(t, reversedOrderIds)) continue
        rows.push({ kind: "single", key: t.id, t })
      }
    }
    const counts: Record<EarningsActivityStatusFilter, number> = {
      all: rows.length,
      available: 0,
      pending: 0,
      refund: 0,
      cashout: 0,
    }
    for (const r of rows) {
      for (const f of ["available", "pending", "refund", "cashout"] as const) {
        if (txRowMatchesStatusFilter(r, f, reversedOrderIds)) counts[f] += 1
      }
    }
    return counts
  }, [transactions, reversedOrderIds])
}

export function EarningsActivity({
  transactions,
  reversedOrderIds,
  hasMore,
  isLoading,
  isLoadingMore,
  loadError,
  loadMoreError,
  onLoadMore,
  onCollapseLoadedActivity,
  heading = "Activity",
  caption,
  globalEmptyCopy,
}: {
  transactions: EarningsTransaction[]
  reversedOrderIds: Set<string>
  hasMore: boolean
  isLoading: boolean
  isLoadingMore: boolean
  loadError: string | null
  loadMoreError: string | null
  onLoadMore: () => void | Promise<void>
  /** Collapse list to the first page after Load more (optional). */
  onCollapseLoadedActivity?: () => void
  heading?: string
  caption?: string
  globalEmptyCopy?: { title: string; body: string }
}) {
  const [activityStatusFilter, setActivityStatusFilter] = useState<EarningsActivityStatusFilter>("all")
  const counts = useFilterCounts(transactions, reversedOrderIds)

  return (
    <section>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{heading}</h2>
          {caption ? (
            <p className="text-sm text-muted-foreground mt-1 max-w-xl leading-relaxed">{caption}</p>
          ) : null}
        </div>

        <div
          role="tablist"
          aria-label="Filter activity by type"
          className="inline-flex rounded-md border border-border bg-muted/40 p-0.5 self-start sm:self-auto"
        >
          {FILTERS.map((f) => {
            const active = activityStatusFilter === f.value
            const c = counts[f.value]
            return (
              <button
                key={f.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActivityStatusFilter(f.value)}
                className={cn(
                  "relative inline-flex items-center gap-1.5 rounded-[5px] px-2.5 sm:px-3 py-1 text-xs font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                  active
                    ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span>{f.label}</span>
                <span
                  className={cn(
                    "inline-flex min-w-[1.25rem] justify-center rounded-sm px-1 py-[1px] text-[10px] font-semibold tabular-nums",
                    active ? "bg-muted text-foreground" : "bg-background/60 text-muted-foreground",
                  )}
                >
                  {c}
                </span>
              </button>
            )
          })}
        </div>
      </header>

      {loadError && !isLoading ? (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Activity didn&apos;t load</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}

      {isLoading ? (
        <EarningsActivitySkeleton />
      ) : loadError ? null : (
        <>
          <EarningsActivityList
            transactions={transactions}
            statusFilter={activityStatusFilter}
            reversedOrderIds={reversedOrderIds}
            isLoadingMore={isLoadingMore}
            hasMore={hasMore}
            onLoadMore={() => void onLoadMore()}
            pageSize={EARNINGS_ACTIVITY_PAGE_SIZE}
            globalEmptyCopy={globalEmptyCopy}
            onCollapseLoadedActivity={onCollapseLoadedActivity}
          />
          {loadMoreError ? (
            <p className="text-sm text-destructive mt-2" role="alert">
              {loadMoreError}
            </p>
          ) : null}
        </>
      )}
    </section>
  )
}
