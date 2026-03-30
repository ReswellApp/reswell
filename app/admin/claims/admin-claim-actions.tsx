'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  PROTECTION_COVERAGE_CAP,
  PROTECTION_FUND_MINIMUM_RESERVE,
  type ClaimType,
} from '@/lib/protection-constants'
import { cn } from '@/lib/utils'

interface AdminClaimActionsProps {
  claimId: string
  claimType: ClaimType
  claimedAmount: number
  orderAmount: number
  fundBalance: number
}

export function AdminClaimActions({
  claimId,
  claimType,
  claimedAmount,
  orderAmount,
  fundBalance,
}: AdminClaimActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [mode, setMode] = useState<'idle' | 'approve' | 'deny'>('idle')
  const [approvedAmount, setApprovedAmount] = useState<string>(() => {
    if (claimType === 'NOT_RECEIVED') return orderAmount.toFixed(2)
    return Math.min(claimedAmount, PROTECTION_COVERAGE_CAP).toFixed(2)
  })
  const [denialReason, setDenialReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const fundAfterPayout = fundBalance - parseFloat(approvedAmount || '0')
  const fundWillRunLow = fundAfterPayout < PROTECTION_FUND_MINIMUM_RESERVE

  async function submit(action: 'approve' | 'deny') {
    setError(null)
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/protection/claims/${claimId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action,
            approved_amount: action === 'approve' ? parseFloat(approvedAmount) : undefined,
            denial_reason: action === 'deny' ? denialReason : undefined,
            payout_method: 'ORIGINAL_PAYMENT',
          }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error ?? 'Something went wrong.')
          return
        }
        router.refresh()
      } catch {
        setError('Network error. Please try again.')
      }
    })
  }

  if (mode === 'idle') {
    return (
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          className="bg-green-600 hover:bg-green-700 text-white"
          onClick={() => setMode('approve')}
        >
          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
          Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
          onClick={() => setMode('deny')}
        >
          <XCircle className="h-3.5 w-3.5 mr-1.5" />
          Deny
        </Button>
      </div>
    )
  }

  if (mode === 'approve') {
    return (
      <div className="rounded-lg border border-green-200 dark:border-green-800/40 bg-green-50/60 dark:bg-green-950/20 p-3 space-y-3">
        <p className="text-sm font-semibold text-green-900 dark:text-green-300">Approve claim</p>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">
            Approved amount
            {claimType === 'NOT_RECEIVED' && (
              <span className="ml-1 text-green-600 dark:text-green-400">(no cap — full refund)</span>
            )}
            {claimType !== 'NOT_RECEIVED' && (
              <span className="ml-1 text-muted-foreground">(max ${PROTECTION_COVERAGE_CAP})</span>
            )}
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={claimType === 'NOT_RECEIVED' ? undefined : PROTECTION_COVERAGE_CAP}
              value={approvedAmount}
              onChange={(e) => setApprovedAmount(e.target.value)}
              className="w-full rounded-lg border bg-background pl-7 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {fundWillRunLow && (
          <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Fund will drop to ${fundAfterPayout.toFixed(2)} — below $500 reserve.
          </p>
        )}

        {error && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => setMode('idle')}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white"
            disabled={isPending || !approvedAmount || parseFloat(approvedAmount) <= 0}
            onClick={() => submit('approve')}
          >
            {isPending ? 'Approving…' : 'Confirm approval'}
          </Button>
        </div>
      </div>
    )
  }

  // mode === 'deny'
  return (
    <div className="rounded-lg border border-red-200 dark:border-red-800/40 bg-red-50/60 dark:bg-red-950/20 p-3 space-y-3">
      <p className="text-sm font-semibold text-red-900 dark:text-red-300">Deny claim</p>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground">
          Reason (shown to buyer in plain English)
        </label>
        <textarea
          rows={3}
          placeholder="The tracking information confirms the item was delivered to your address on [date]."
          value={denialReason}
          onChange={(e) => setDenialReason(e.target.value)}
          className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {error && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={() => setMode('idle')}>
          Cancel
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={isPending || denialReason.trim().length < 20}
          onClick={() => submit('deny')}
        >
          {isPending ? 'Denying…' : 'Confirm denial'}
        </Button>
      </div>
    </div>
  )
}
