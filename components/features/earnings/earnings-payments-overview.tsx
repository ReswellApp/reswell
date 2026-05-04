"use client"

import { useMemo, useState } from "react"
import { Banknote, CheckCircle2, HelpCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { SellerEarningsDashboardTotals } from "@/lib/db/sellerEarningsTotals"
import type { EarningsTransaction, EarningsWalletSnapshot } from "./earnings-types"
import type { StripeConnectStatusPayload } from "./stripe-bank-payout-section"

function msDays(d: number) {
  return d * 24 * 60 * 60 * 1000
}

const PERIOD_OPTIONS = [
  { value: "30", days: 30, label: "in the last 30 days" },
  { value: "90", days: 90, label: "in the last 3 months" },
  { value: "365", days: 365, label: "in the last 12 months" },
] as const

function earnedInPeriodUsd(transactions: EarningsTransaction[], periodDays: number): number {
  const now = Date.now()
  const start = now - msDays(periodDays)
  let sum = 0
  for (const t of transactions) {
    const ts = new Date(t.created_at).getTime()
    if (ts < start) continue
    const amt = parseFloat(t.amount)
    if (!Number.isFinite(amt) || amt <= 0) continue
    if (t.type !== "sale" && t.type !== "deposit") continue
    sum += amt
  }
  return sum
}

export function EarningsPaymentsOverviewSkeleton() {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {Array.from({ length: 2 }).map((_, i) => (
        <Card key={i} className="border-border/80">
          <CardContent className="p-4 space-y-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-full" />
            {i === 1 ? <Skeleton className="h-16 w-full rounded-md mt-2" /> : null}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function EarningsPaymentsOverview({
  wallet,
  transactions,
  sellerOrderTotals,
  isLoading,
  errorMessage,
  stripePayoutsEnabled,
  stripeLoading,
  connectStatus,
  statusFetchFailed,
  activityHasMore,
  onScrollToBankPayout,
}: {
  wallet: EarningsWalletSnapshot | null
  transactions: EarningsTransaction[]
  /** When set, period earnings sum all qualifying orders (not paginated wallet activity). */
  sellerOrderTotals: SellerEarningsDashboardTotals | null
  isLoading: boolean
  errorMessage: string | null
  stripePayoutsEnabled: boolean
  stripeLoading: boolean
  connectStatus: StripeConnectStatusPayload | null
  statusFetchFailed: boolean
  activityHasMore: boolean
  onScrollToBankPayout: () => void
}) {
  const [periodValue, setPeriodValue] = useState<string>(PERIOD_OPTIONS[0].value)
  const periodDays =
    PERIOD_OPTIONS.find((p) => p.value === periodValue)?.days ?? PERIOD_OPTIONS[0].days
  const periodLabel =
    PERIOD_OPTIONS.find((p) => p.value === periodValue)?.label ?? PERIOD_OPTIONS[0].label

  const earned = useMemo(() => {
    if (sellerOrderTotals) {
      if (periodDays === 30) return sellerOrderTotals.earnedLast30dUsd
      if (periodDays === 90) return sellerOrderTotals.earnedLast90dUsd
      if (periodDays === 365) return sellerOrderTotals.earnedLast365dUsd
    }
    return earnedInPeriodUsd(transactions, periodDays)
  }, [sellerOrderTotals, periodDays, transactions])

  const overviewFromOrders = Boolean(sellerOrderTotals)

  if (isLoading) {
    return <EarningsPaymentsOverviewSkeleton />
  }

  if (errorMessage || !wallet) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Couldn&apos;t load overview</AlertTitle>
        <AlertDescription>{errorMessage ?? "Something went wrong. Try refresh."}</AlertDescription>
      </Alert>
    )
  }

  const walletBalance = parseFloat(wallet.balance)
  const pendingRaw = parseFloat(wallet.pending_balance ?? "0")
  const displayAvailable = walletBalance
  const displayPending = Number.isFinite(pendingRaw) ? pendingRaw : 0
  const displayTotal = displayAvailable + displayPending

  const bankReady =
    Boolean(connectStatus?.hasAccount) &&
    Boolean(connectStatus?.payoutsEnabled) &&
    Boolean(connectStatus?.detailsSubmitted)

  return (
    <TooltipProvider delayDuration={200}>
      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="border-border/80 shadow-sm">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <Select value={periodValue} onValueChange={setPeriodValue}>
                  <SelectTrigger className="w-full text-left font-normal" aria-label="Earnings period">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIOD_OPTIONS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="mt-0.5 shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    aria-label="How this earnings total is calculated"
                  >
                    <HelpCircle className="h-4 w-4" aria-hidden />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  align="end"
                  className="max-w-[19rem] text-xs leading-relaxed space-y-2 px-3 py-2.5"
                >
                  {overviewFromOrders ? (
                    <p>
                      This total is your <span className="font-semibold">seller share</span> (after Reswell&apos;s fee)
                      from every marketplace order in the window, using your full order history. Fully refunded orders
                      are excluded.
                    </p>
                  ) : (
                    <p>
                      This number sums <span className="font-semibold">sale</span> and{" "}
                      <span className="font-semibold">deposit</span> credits in the window you picked, using wallet history
                      already loaded in this session—not payouts, purchases, or refunds.
                    </p>
                  )}
                  {!overviewFromOrders && activityHasMore ? (
                    <p>
                      Totals use loaded history only. Under <span className="font-semibold">Payout history</span> below,
                      use <span className="font-semibold">Load more</span> if this period might include older sales.
                    </p>
                  ) : null}
                </TooltipContent>
              </Tooltip>
            </div>
            <p className="text-sm text-muted-foreground leading-snug">
              You&apos;ve earned{" "}
              <span className="text-primary font-semibold tabular-nums text-base sm:text-lg">
                ${earned.toFixed(2)}
              </span>{" "}
              on Reswell <span className="text-muted-foreground">{periodLabel}</span>.
            </p>
          </CardContent>
        </Card>

        <Card
          className={cn(
            "border-transparent shadow-sm text-primary-foreground",
            // Light theme: primary token is very dark (~11% L); soften so the card isn’t near-black.
            "bg-[hsl(222_36%_30%)] dark:bg-primary",
            // Readable text selection on the tinted balance panel
            "selection:bg-sky-300 selection:text-slate-950 dark:selection:bg-sky-700 dark:selection:text-sky-50",
          )}
        >
          <CardContent className="p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-medium opacity-95">
                <Banknote className="h-4 w-4 shrink-0" aria-hidden />
                Balance
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="rounded-full p-1 opacity-90 hover:opacity-100 hover:bg-primary-foreground/15 transition-colors"
                    aria-label="How your balance works"
                  >
                    <HelpCircle className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  align="end"
                  className="max-w-[19rem] text-xs leading-relaxed space-y-2 px-3 py-2.5"
                >
                  <p>
                    <span className="font-semibold text-foreground">Total</span> is your ready balance plus pending
                    earnings. When a sale clears, pending becomes ready—only ready funds can be spent on Reswell or
                    cashed out.
                  </p>
                  <p>
                    When someone pays, that sale appears as <span className="font-semibold">pending</span> until delivery
                    or pickup is done. Then it moves to <span className="font-semibold">ready</span>—money you can spend
                    on Reswell or pay out.
                  </p>
                  <p>
                    {stripePayoutsEnabled
                      ? "Use Bank transfers below to move ready balance to your linked account."
                      : "Bank payouts will be available when Stripe Connect is enabled for this workspace."}
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>

            <p className="text-sm text-primary-foreground/80 leading-relaxed -mt-0.5">
              Your balance can be transferred to a linked bank account.
            </p>

            <div className="space-y-2">
              <div>
                <p className="text-[11px] font-medium tracking-wide text-primary-foreground/75 mb-0.5 leading-snug">
                  Ready to transfer to your bank
                </p>
                <p className="text-2xl sm:text-3xl font-bold tabular-nums tracking-tight">
                  ${displayAvailable.toFixed(2)}
                </p>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-sm">
                <div>
                  <p className="text-[11px] text-primary-foreground/75 mb-0.5">Total (including pending)</p>
                  <p className="text-base font-semibold tabular-nums">${displayTotal.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-primary-foreground/75 mb-0.5">Pending (until order confirmed)</p>
                  <p className="text-base font-semibold tabular-nums">${displayPending.toFixed(2)}</p>
                </div>
              </div>
            </div>

            <div className="pt-2 mt-1 border-t border-primary-foreground/20 space-y-3 text-left text-sm">
              {!stripePayoutsEnabled ? (
                <p className="text-primary-foreground/85 leading-relaxed">
                  Bank payouts aren&apos;t enabled for this workspace. Your balance still tracks sales and refunds.
                </p>
              ) : stripeLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-3.5 w-full bg-primary-foreground/15" />
                  <Skeleton className="h-9 w-48 rounded-md bg-primary-foreground/15" />
                </div>
              ) : statusFetchFailed ? (
                <p className="text-primary-foreground/85 leading-relaxed">
                  We couldn&apos;t verify your payout setup. Use <span className="font-medium">Refresh</span> at the top
                  of the page, or finish setup in <span className="font-medium">Bank transfers</span> below.
                </p>
              ) : bankReady ? (
                <div className="flex gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-300 shrink-0 mt-0.5" aria-hidden />
                  <p className="text-primary-foreground/90 leading-relaxed">
                    <span className="font-medium">Payout details on file.</span>{" "}
                    {connectStatus?.bankLast4 ? (
                      <>
                        Linked account ending in <span className="font-mono tabular-nums">{connectStatus.bankLast4}</span>
                        . Cash out in Bank transfers below.
                      </>
                    ) : (
                      <>You can cash out in Bank transfers below.</>
                    )}
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <p className="text-primary-foreground/90 leading-relaxed">
                    Payout details aren&apos;t finished yet. Complete them before earnings can transfer to your bank.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="w-full sm:w-auto font-medium bg-primary-foreground text-primary hover:bg-primary-foreground/90"
                    onClick={onScrollToBankPayout}
                  >
                    Complete payout details
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  )
}
