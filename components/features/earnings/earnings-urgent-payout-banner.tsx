"use client"

import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { StripeConnectStatusPayload } from "@/lib/utils/stripe-connect-status"

interface EarningsUrgentPayoutBannerProps {
  connectStatus: StripeConnectStatusPayload | null
  onUpdate: () => void
}

/** Stays at the top of Earnings until Stripe clears past-due and currently-due fields. */
export function EarningsUrgentPayoutBanner({
  connectStatus,
  onUpdate,
}: EarningsUrgentPayoutBannerProps) {
  const items = connectStatus?.urgentRequirementsChecklist ?? []
  if (items.length === 0) return null

  const message =
    connectStatus?.urgentRequirementsMessage ??
    "Stripe needs more details to keep this payout account active."

  return (
    <div className="sticky top-24 z-30">
      <div
        role="status"
        className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 shadow-sm dark:border-amber-800 dark:bg-amber-950"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
            <div className="min-w-0 space-y-2">
              <p className="text-sm font-medium text-amber-950 dark:text-amber-50">{message}</p>
              <ul className="space-y-1">
                {items.map((item) => (
                  <li key={item} className="text-sm text-amber-900 dark:text-amber-100">
                    {item}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-amber-800/90 dark:text-amber-200/90">
                This stays on Earnings until Stripe accepts the update.
              </p>
            </div>
          </div>
          <Button
            type="button"
            className="shrink-0 rounded-full bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            onClick={onUpdate}
          >
            Update info
          </Button>
        </div>
      </div>
    </div>
  )
}
