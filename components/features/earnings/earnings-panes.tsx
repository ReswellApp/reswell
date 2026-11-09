"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { ChevronLeft, DollarSign } from "lucide-react"
import { EarningsActivity } from "@/components/features/earnings/earnings-activity"
import { EarningsListingThumb } from "@/components/features/earnings/earnings-listing-thumb"
import { EarningsReswellCreditSection } from "@/components/features/earnings/earnings-reswell-credit-section"
import type { EarningsTransaction } from "@/components/features/earnings/earnings-types"
import { Button } from "@/components/ui/button"
import type { EarningsBalanceListingRow } from "@/lib/earnings-balance-listings"
import { earningsHref } from "@/lib/earnings-view"
import { formatUsd } from "@/lib/utils/format-usd"

export function EarningsDetailShell({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="space-y-5">
      <Link
        href={earningsHref()}
        className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/80"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Earnings
      </Link>
      {title ? <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1> : null}
      {children}
    </div>
  )
}

export function EarningsEmpty({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center px-8 pb-8 pt-12 text-center">
      <span className="mb-4 flex h-[72px] w-[72px] items-center justify-center rounded-[20px] bg-listingHeart text-white">
        <DollarSign className="h-7 w-7" aria-hidden />
      </span>
      <p className="text-xl font-bold text-foreground">{title}</p>
      <p className="mt-2 max-w-md text-base leading-snug text-muted-foreground">{body}</p>
    </div>
  )
}

export function EarningsPendingPane({
  amountLabel,
  rows,
}: {
  amountLabel: string
  rows: EarningsBalanceListingRow[]
}) {
  return (
    <EarningsDetailShell title="Pending Release">
      <div className="rounded-2xl bg-[#E7EEF8] px-5 py-5 dark:bg-listingHeart/15">
        <p className="text-xs font-bold uppercase tracking-wider text-listingHeart">Total pending</p>
        <p className="mt-1 text-4xl font-bold tracking-tight text-foreground">{amountLabel}</p>
      </div>
      {rows.length === 0 ? (
        <EarningsEmpty
          title="No earnings pending"
          body="When you sell a board and the buyer pays, your pending earnings will appear here."
        />
      ) : (
        <EarningsSaleRows rows={rows} />
      )}
    </EarningsDetailShell>
  )
}

export function EarningsAvailablePane({
  amountLabel,
  rows,
  showTransfer,
  payout,
}: {
  amountLabel: string
  rows: EarningsBalanceListingRow[]
  showTransfer: boolean
  payout?: ReactNode
}) {
  return (
    <EarningsDetailShell title="Available">
      <div className="rounded-2xl bg-muted/70 px-5 py-5">
        <p className="text-xs font-bold uppercase tracking-wider text-listingHeart">Available balance</p>
        <p className="mt-1 text-4xl font-bold tracking-tight text-foreground">{amountLabel}</p>
        {showTransfer ? (
          <Button
            asChild
            className="mt-4 h-12 w-full rounded-full bg-listingHeart text-[17px] font-bold text-white hover:bg-listingHeart/90"
          >
            <a href="#earnings-bank-payout">Transfer Funds</a>
          </Button>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <EarningsEmpty
          title="No available earnings"
          body="When you make a sale and the earnings are released, they will appear here."
        />
      ) : (
        <EarningsSaleRows rows={rows} />
      )}
      {payout}
    </EarningsDetailShell>
  )
}

export function EarningsActivityPane({
  transactions,
  reversedOrderIds,
  hasMore,
  isLoading,
  isLoadingMore,
  loadError,
  loadMoreError,
  onLoadMore,
  onCollapseLoadedActivity,
}: {
  transactions: EarningsTransaction[]
  reversedOrderIds: Set<string>
  hasMore: boolean
  isLoading: boolean
  isLoadingMore: boolean
  loadError: string | null
  loadMoreError: string | null
  onLoadMore: () => void | Promise<void>
  onCollapseLoadedActivity: () => void
}) {
  return (
    <EarningsDetailShell title="">
      <EarningsActivity
        transactions={transactions}
        reversedOrderIds={reversedOrderIds}
        hasMore={hasMore}
        isLoading={isLoading}
        isLoadingMore={isLoadingMore}
        loadError={loadError}
        loadMoreError={loadMoreError}
        onLoadMore={onLoadMore}
        onCollapseLoadedActivity={onCollapseLoadedActivity}
        heading="Activity"
        globalEmptyCopy={{
          title: "Nothing in this view",
          body: "Sales, payouts, and refunds that match this filter will show up here.",
        }}
      />
    </EarningsDetailShell>
  )
}

export function EarningsCreditPane() {
  return (
    <EarningsDetailShell title="Reswell Credit">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Rewards for buying and selling on Reswell. Use on checkout — never cashable, and separate from
        available earnings.
      </p>
      <EarningsReswellCreditSection />
    </EarningsDetailShell>
  )
}

function EarningsSaleRows({ rows }: { rows: EarningsBalanceListingRow[] }) {
  return (
    <ul className="divide-y divide-border/70" role="list">
      {rows.map((row) => {
        const href = row.saleHref ?? row.listingHref
        const title = row.extraListingCount > 0 ? `${row.title} + ${row.extraListingCount} more` : row.title
        const body = (
          <>
            <EarningsListingThumb src={row.imageUrl} alt="" className="h-[52px] w-[52px] rounded-lg" />
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 text-[15px] font-semibold text-foreground">{title}</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">
                {row.status === "pending" ? "Pending" : "Ready"} · {activityDate(row.createdAt)}
              </span>
            </span>
            <span className="shrink-0 text-[15px] font-bold tabular-nums text-listingHeart">
              {formatUsd(row.amountUsd)}
            </span>
          </>
        )
        return (
          <li key={row.key}>
            {href ? (
              <Link
                href={href}
                className="flex items-center gap-3 py-3.5 transition-colors hover:bg-muted/30"
              >
                {body}
              </Link>
            ) : (
              <div className="flex items-center gap-3 py-3.5">{body}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function activityDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}
