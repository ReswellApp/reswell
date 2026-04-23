"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, Banknote, CheckCircle2, HelpCircle } from "lucide-react"
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
import type { EarningsTransaction, EarningsWalletSnapshot } from "./earnings-types"
import type { StripeConnectStatusPayload } from "./stripe-bank-payout-section"

function msDays(d: number) {
  return d * 24 * 60 * 60 * 1000
}

const PERIOD_OPTIONS = [
  { value: "90", days: 90, label: "in the last 3 months" },
  { value: "30", days: 30, label: "in the last 30 days" },
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
    <div className="grid gap-3 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="border-border/80">
          <CardContent className="p-4 space-y-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function EarningsPaymentsOverview({
  wallet,
  transactions,
  isLoading,
  errorMessage,
  stripePayoutsEnabled,
  stripeLoading,
  connectStatus,
  activityHasMore,
}: {
  wallet: EarningsWalletSnapshot | null
  transactions: EarningsTransaction[]
  isLoading: boolean
  errorMessage: string | null
  stripePayoutsEnabled: boolean
  stripeLoading: boolean
  connectStatus: StripeConnectStatusPayload | null
  activityHasMore: boolean
}) {
  const [periodValue, setPeriodValue] = useState<string>(PERIOD_OPTIONS[0].value)
  const periodDays =
    PERIOD_OPTIONS.find((p) => p.value === periodValue)?.days ?? PERIOD_OPTIONS[0].days
  const periodLabel =
    PERIOD_OPTIONS.find((p) => p.value === periodValue)?.label ?? PERIOD_OPTIONS[0].label

  const earned = useMemo(
    () => earnedInPeriodUsd(transactions, periodDays),
    [transactions, periodDays],
  )

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
      <div className="grid gap-3 lg:grid-cols-3">
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
                  <p>
                    This number sums <span className="font-semibold">sale</span> and{" "}
                    <span className="font-semibold">deposit</span> credits in the window you picked, using wallet history
                    already loaded in this session—not payouts, purchases, or refunds.
                  </p>
                  {activityHasMore ? (
                    <p>
                      Totals use loaded history only. In <span className="font-semibold">Payout balance</span>, use{" "}
                      <span className="font-semibold">Load more</span> under payout history if this period might include
                      older sales.
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

        <Card className="border-border/80 shadow-sm">
          <CardContent className="p-4">
            {!stripePayoutsEnabled ? (
              <p className="text-sm text-muted-foreground leading-relaxed">
                Bank payouts aren&apos;t enabled for this app build. Your marketplace balance still updates with sales
                and refunds.
              </p>
            ) : stripeLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : bankReady ? (
              <div className="flex gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" aria-hidden />
                <div className="text-sm leading-relaxed">
                  <p className="font-medium text-foreground">You&apos;re set up for bank payouts</p>
                  {connectStatus?.bankLast4 ? (
                    <p className="text-muted-foreground mt-1">
                      Linked account ending in <span className="font-mono">{connectStatus.bankLast4}</span>
                    </p>
                  ) : (
                    <p className="text-muted-foreground mt-1">Use the bank section below to cash out.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" aria-hidden />
                <p className="text-sm leading-relaxed text-foreground">
                  Provide your{" "}
                  <Link
                    href="#earnings-bank-payout"
                    className="font-semibold underline underline-offset-2 decoration-foreground/70 hover:decoration-foreground"
                  >
                    bank information
                  </Link>{" "}
                  so you can get paid.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card
          className={cn(
            "border-transparent shadow-sm text-primary-foreground",
            "bg-primary",
            // Readable text selection on dark primary (avoid default / OS black wash)
            "selection:bg-sky-300 selection:text-slate-950",
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

            <div className="space-y-2">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-primary-foreground/75 mb-0.5">
                  Total (including pending)
                </p>
                <p className="text-2xl sm:text-3xl font-bold tabular-nums tracking-tight">
                  ${displayTotal.toFixed(2)}
                </p>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-sm">
                <div>
                  <p className="text-[11px] text-primary-foreground/75 mb-0.5">Ready to spend</p>
                  <p className="text-base font-semibold tabular-nums">${displayAvailable.toFixed(2)}</p>
                </div>
                {displayPending > 0 ? (
                  <div>
                    <p className="text-[11px] text-primary-foreground/75 mb-0.5">Pending (until delivery)</p>
                    <p className="text-base font-semibold tabular-nums text-primary-foreground/90">
                      ${displayPending.toFixed(2)}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  )
}
