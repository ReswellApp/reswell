'use client'

import { useEffect, useId, useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

export interface AdminWalletCreditSummary {
  balance: number
  pendingBalance: number
  totalBalance: number
  lifetime_earned: number
  lifetime_spent: number
  lifetime_cashed_out: number
  spendableBucks?: number
  inWalletOwed?: number
  walletId: string | null
}

export interface AdminWalletCreditResult {
  amountUsd: number
  summary: AdminWalletCreditSummary | null
}

interface AdminWalletCreditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string | null
  displayName?: string | null
  email?: string | null
  defaultNote?: string
  onCredited?: (result: AdminWalletCreditResult) => void
}

function parseCreditAmount(raw: string): number | null {
  const amountUsd = Number.parseFloat(raw)
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) return null
  return Math.round(amountUsd * 100) / 100
}

export function AdminWalletCreditDialog({
  open,
  onOpenChange,
  userId,
  displayName,
  email,
  defaultNote = '',
  onCredited,
}: AdminWalletCreditDialogProps) {
  const amountId = useId()
  const noteId = useId()
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState(defaultNote)
  const [submitting, setSubmitting] = useState(false)
  const recipient = displayName?.trim() || email?.trim() || 'this user'

  useEffect(() => {
    if (!open) return
    setAmount('')
    setNote(defaultNote)
  }, [open, defaultNote])

  function close() {
    if (submitting) return
    onOpenChange(false)
  }

  async function confirmCredit() {
    if (!userId) return
    const amountUsd = parseCreditAmount(amount)
    if (amountUsd == null) {
      toast.error('Enter an amount greater than $0')
      return
    }
    if (amountUsd > 5000) {
      toast.error('Amount cannot exceed $5,000')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}/wallet/credit`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount_usd: amountUsd,
          note: note.trim() || undefined,
        }),
      })
      const body = (await res.json().catch(() => null)) as {
        success?: boolean
        data?: AdminWalletCreditSummary
        error?: string
        amount_usd?: number
      } | null
      if (!res.ok) {
        toast.error(body?.error ?? 'Could not credit wallet')
        return
      }

      const credited = body?.amount_usd ?? amountUsd
      onCredited?.({
        amountUsd: credited,
        summary: body?.data ?? null,
      })
      toast.success(`Added $${credited.toFixed(2)} to ${recipient}`)
      onOpenChange(false)
    } catch {
      toast.error('Could not credit wallet')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add wallet credit</DialogTitle>
          <DialogDescription>
            Adds spendable balance for <span className="font-medium text-foreground">{recipient}</span>.
            This shows on Earnings and can be used at checkout. Maximum $5,000.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor={amountId} className="text-sm font-medium">
              Amount (USD)
            </label>
            <Input
              id={amountId}
              type="number"
              inputMode="decimal"
              min="0.01"
              max="5000"
              step="0.01"
              placeholder="80.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={noteId} className="text-sm font-medium">
              Note <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <Input
              id={noteId}
              maxLength={500}
              placeholder="Purchase Protection repair credit"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={close} disabled={submitting}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void confirmCredit()} disabled={submitting || !userId}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Crediting…
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" /> Add credit
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
