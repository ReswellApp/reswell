"use client"

import { AlertCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  StripeBankPayoutSection,
  type StripeBankPayoutSectionProps,
  type StripeConnectStatusPayload,
} from "@/components/features/earnings/stripe-bank-payout-section"

interface StripeTransferHistoryItem {
  id: string
  amount: string | number
  fee_amount?: string | number | null
  payout_speed?: string | null
  stripe_transfer_id: string | null
  stripe_payout_id?: string | null
  status: string
  created_at: string
}

export function EarningsStripePayoutCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-4 w-full max-w-lg" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-24 w-full" />
      </CardContent>
    </Card>
  )
}

/**
 * Bank payout (Stripe Connect) block with loading skeleton and soft failure when status/history APIs error.
 */
export function EarningsStripePayoutCard({
  enabled,
  isLoading,
  statusFetchFailed,
  historyFetchFailed,
  onRetry,
  availableBalance,
  connectStatus,
  transferHistory,
  onRefresh,
  onCashOutSettled,
}: {
  enabled: boolean
  isLoading: boolean
  statusFetchFailed: boolean
  historyFetchFailed: boolean
  onRetry: () => void
  availableBalance: number
  connectStatus: StripeConnectStatusPayload | null
  transferHistory: StripeTransferHistoryItem[]
  onRefresh: () => void | Promise<void>
  onCashOutSettled?: StripeBankPayoutSectionProps["onCashOutSettled"]
}) {
  if (!enabled) {
    return null
  }

  if (isLoading) {
    return <EarningsStripePayoutCardSkeleton />
  }

  const partialFailure = statusFetchFailed || historyFetchFailed

  return (
    <div className="space-y-3">
      {partialFailure && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Some payout data didn&apos;t load</AlertTitle>
          <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <span className="text-sm">
              {statusFetchFailed && historyFetchFailed
                ? "We couldn’t refresh your bank connection or payout history."
                : statusFetchFailed
                  ? "We couldn’t refresh your bank connection status."
                  : "We couldn’t refresh your payout history."}{" "}
              Your balance above is still up to date.
            </span>
            <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => void onRetry()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <StripeBankPayoutSection
        availableBalance={availableBalance}
        stripeConfigured={enabled}
        connectStatus={connectStatus}
        transferHistory={transferHistory}
        onRefresh={onRefresh}
        onCashOutSettled={onCashOutSettled}
      />
    </div>
  )
}
