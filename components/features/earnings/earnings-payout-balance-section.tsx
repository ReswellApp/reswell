"use client"

import { CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { cn } from "@/lib/utils"
import type { EarningsWalletSnapshot } from "./earnings-types"
import type { StripeConnectStatusPayload } from "./stripe-bank-payout-section"

export function EarningsPayoutBalanceSectionSkeleton() {
  return (
    <section className="space-y-6 pb-8 border-b border-border">
      <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
        <div>
          <Skeleton className="h-7 w-40 mb-2" />
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
        <div className="lg:text-right space-y-3">
          <Skeleton className="h-10 w-36 ml-auto" />
          <Skeleton className="h-4 w-20 ml-auto" />
          <Skeleton className="h-24 w-full max-w-md ml-auto rounded-lg" />
        </div>
      </div>
    </section>
  )
}

export function EarningsPayoutBalanceSection({
  wallet,
  isLoading,
  errorMessage,
  stripePayoutsEnabled,
  stripeLoading,
  connectStatus,
  statusFetchFailed,
  onCompletePayoutDetails,
}: {
  wallet: EarningsWalletSnapshot | null
  isLoading: boolean
  errorMessage: string | null
  stripePayoutsEnabled: boolean
  stripeLoading: boolean
  connectStatus: StripeConnectStatusPayload | null
  statusFetchFailed: boolean
  onCompletePayoutDetails: () => void
}) {
  if (isLoading) {
    return <EarningsPayoutBalanceSectionSkeleton />
  }

  if (errorMessage || !wallet) {
    return (
      <section className="pb-8 border-b border-border">
        <Alert variant="destructive">
          <AlertTitle>Couldn&apos;t load payout balance</AlertTitle>
          <AlertDescription>{errorMessage ?? "Something went wrong. Try refresh."}</AlertDescription>
        </Alert>
      </section>
    )
  }

  const ready = parseFloat(wallet.balance)
  const pendingRaw = parseFloat(wallet.pending_balance ?? "0")
  const pending = Number.isFinite(pendingRaw) ? pendingRaw : 0

  const bankReady =
    Boolean(connectStatus?.hasAccount) &&
    Boolean(connectStatus?.payoutsEnabled) &&
    Boolean(connectStatus?.detailsSubmitted)

  return (
    <section className="space-y-6 pb-8 border-b border-border">
      <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Payout balance</h2>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-md leading-relaxed">
            Your balance can be transferred to a linked bank account.
          </p>
        </div>

        <div className="lg:text-right space-y-4">
          <div>
            <p className="text-3xl sm:text-4xl font-bold tabular-nums text-foreground tracking-tight">
              ${ready.toFixed(2)}
            </p>
            <p className="text-sm text-muted-foreground mt-1">Balance</p>
            {pending > 0 ? (
              <p className="text-xs text-muted-foreground mt-2 tabular-nums">
                ${pending.toFixed(2)} pending (not available for payout until sales clear)
              </p>
            ) : null}
          </div>

          {!stripePayoutsEnabled ? (
            <p className="text-sm text-muted-foreground text-left lg:text-right max-w-md lg:ml-auto leading-relaxed">
              Bank payouts aren&apos;t enabled for this workspace. Your balance still tracks sales and refunds.
            </p>
          ) : stripeLoading ? (
            <div className="space-y-2 max-w-md lg:ml-auto">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-10 w-48 ml-auto" />
            </div>
          ) : statusFetchFailed ? (
            <div
              className={cn(
                "rounded-lg border border-border bg-muted/40 px-4 py-3 text-left text-sm text-muted-foreground",
                "max-w-md lg:ml-auto",
              )}
            >
              We couldn&apos;t verify your payout setup. Use Refresh above, or open{" "}
              <span className="font-medium text-foreground">Payments</span> and try again.
            </div>
          ) : bankReady ? (
            <div className="flex items-start gap-2 justify-end text-left lg:text-right max-w-md lg:ml-auto">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" aria-hidden />
              <p className="text-sm text-muted-foreground leading-relaxed">
                <span className="font-medium text-foreground">Payout details on file.</span>
                {connectStatus?.bankLast4 ? (
                  <>
                    {" "}
                    Linked account ending in{" "}
                    <span className="font-mono tabular-nums">{connectStatus.bankLast4}</span>.
                  </>
                ) : (
                  <> You can cash out from the Payments tab.</>
                )}
              </p>
            </div>
          ) : (
            <div
              className={cn(
                "rounded-lg border border-border bg-muted/35 px-4 py-4 text-left space-y-3",
                "max-w-md lg:ml-auto",
              )}
            >
              <p className="text-sm text-muted-foreground leading-relaxed">
                Payout details aren&apos;t finished yet. Complete them before earnings can transfer to your bank.
              </p>
              <Button type="button" className="w-full sm:w-auto" onClick={onCompletePayoutDetails}>
                Complete payout details
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
