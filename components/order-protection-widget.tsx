'use client'

import Link from 'next/link'
import { ShieldCheck, ShieldOff, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { isProtectionWindowActive, daysRemainingInWindow } from '@/lib/protection-constants'
import { cn } from '@/lib/utils'

interface OrderProtectionWidgetProps {
  purchaseId: string
  windowCloses: string | null
  isEligible: boolean
  ineligibleReason?: string | null
  existingClaimId?: string | null
  existingClaimStatus?: string | null
  /** For local pickup orders — show a different message */
  isLocalPickup?: boolean
}

/**
 * Shown on the purchase detail page.
 * Displays protection countdown and "File a claim" button when eligible.
 */
export function OrderProtectionWidget({
  purchaseId,
  windowCloses,
  isEligible,
  ineligibleReason,
  existingClaimId,
  existingClaimStatus,
  isLocalPickup = false,
}: OrderProtectionWidgetProps) {
  if (isLocalPickup) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
        <div className="flex items-start gap-3">
          <ShieldOff className="h-5 w-5 text-neutral-400 flex-shrink-0 mt-0.5" aria-hidden />
          <div>
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Not covered by Purchase Protection
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Local pickup orders are not eligible — protection requires tracked shipping.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!isEligible && ineligibleReason) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
        <div className="flex items-start gap-3">
          <ShieldOff className="h-5 w-5 text-neutral-400 flex-shrink-0 mt-0.5" aria-hidden />
          <div>
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Protection window closed
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{ineligibleReason}</p>
          </div>
        </div>
      </div>
    )
  }

  if (existingClaimId) {
    const statusLabel: Record<string, string> = {
      PENDING: 'Under Review',
      APPROVED: 'Approved',
      DENIED: 'Denied',
      PAID_OUT: 'Paid',
      WITHDRAWN: 'Withdrawn',
    }

    return (
      <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-800/40 dark:bg-blue-950/20">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" aria-hidden />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-300">
              Claim filed —{' '}
              <span className="font-semibold">
                {statusLabel[existingClaimStatus ?? ''] ?? existingClaimStatus}
              </span>
            </p>
            <p className="text-xs text-blue-700/70 dark:text-blue-400/70 mt-0.5">
              Track your claim status and updates below.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild className="flex-shrink-0">
            <Link href={`/dashboard/claims/${existingClaimId}`}>View claim</Link>
          </Button>
        </div>
      </div>
    )
  }

  // Active window — show countdown
  const active = windowCloses ? isProtectionWindowActive(windowCloses) : true
  const daysLeft = windowCloses ? daysRemainingInWindow(windowCloses) : 30

  let protectedUntilLabel = ''
  if (windowCloses) {
    protectedUntilLabel = new Date(windowCloses).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const urgency = daysLeft <= 5

  return (
    <div
      className={cn(
        'rounded-xl border p-4',
        active
          ? 'border-green-200 bg-green-50/60 dark:border-green-800/40 dark:bg-green-950/20'
          : 'border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/50'
      )}
    >
      <div className="flex items-start gap-3">
        <ShieldCheck
          className={cn(
            'h-5 w-5 flex-shrink-0 mt-0.5',
            active
              ? 'text-green-600 dark:text-green-400'
              : 'text-neutral-400'
          )}
          aria-hidden
        />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p
              className={cn(
                'text-sm font-semibold',
                active
                  ? 'text-green-900 dark:text-green-300'
                  : 'text-neutral-600 dark:text-neutral-400'
              )}
            >
              {active ? 'Purchase protection active' : 'Protection window closed'}
              {protectedUntilLabel && active && (
                <span className="font-normal text-green-700 dark:text-green-400">
                  {' '}— protected until {protectedUntilLabel}
                </span>
              )}
            </p>
            {active && daysLeft > 0 && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                  urgency
                    ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                    : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                )}
              >
                <Clock className="h-3 w-3" aria-hidden />
                {daysLeft} {daysLeft === 1 ? 'day' : 'days'} remaining
              </span>
            )}
          </div>
          <p className="text-xs text-green-700/70 dark:text-green-500/70 mt-0.5">
            {active
              ? 'You can file a claim if something went wrong with this order.'
              : 'The 30-day protection window has closed for this order.'}
          </p>
        </div>
      </div>

      {active && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" asChild className="border-green-300 text-green-800 hover:bg-green-100 dark:border-green-700 dark:text-green-300 dark:hover:bg-green-900/30">
            <Link href={`/dashboard/claims/new/${purchaseId}`}>
              File a claim
            </Link>
          </Button>
          <Button size="sm" variant="ghost" asChild className="text-green-700 dark:text-green-400">
            <Link href="/protection-policy">Learn about coverage</Link>
          </Button>
        </div>
      )}
    </div>
  )
}
