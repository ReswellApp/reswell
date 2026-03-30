'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckCircle2,
  DollarSign,
  XCircle,
  RotateCcw,
  ShieldAlert,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Send,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Dispute } from '@/lib/disputes/types'
import { RETURN_WAIVER_MAX_VALUE } from '@/lib/disputes/constants'

interface AdminDisputeActionsProps {
  dispute: Dispute
}

const WAIVER_REASONS = [
  'Item value under $50 — shipping cost exceeds item value',
  'Item verified unsalvageable via photo evidence',
  'Hazardous material — cannot be shipped',
  'Buyer unable to package/ship (medical exemption)',
  'Other — documented below',
]

export function AdminDisputeActions({ dispute }: AdminDisputeActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [activePanel, setActivePanel] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Action state
  const [approvedAmount, setApprovedAmount] = useState<string>(
    dispute.claimed_amount?.toString() ?? ''
  )
  const [adminNotes, setAdminNotes] = useState('')
  const [waiverReason, setWaiverReason] = useState('')
  const [adminMessage, setAdminMessage] = useState('')

  const isResolved = ['RESOLVED_REFUND', 'RESOLVED_NO_REFUND', 'RESOLVED_KEEP_ITEM', 'CLOSED'].includes(dispute.status)
  const canWaiveReturn =
    Number(dispute.claimed_amount) <= RETURN_WAIVER_MAX_VALUE ||
    dispute.damage_types?.length > 0

  async function doAction(action: string, extra: Record<string, unknown> = {}) {
    setError(null)
    setSuccess(null)
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/disputes/${dispute.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, ...extra }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error ?? 'Something went wrong.')
          return
        }
        setSuccess(`Action completed. Status: ${data.status ?? 'updated'}`)
        setActivePanel(null)
        router.refresh()
      } catch {
        setError('Network error. Please try again.')
      }
    })
  }

  async function approveFullRefundWithReturn() {
    await doAction('APPROVE_FULL_REFUND_WITH_RETURN')
  }

  async function approvePartial(waiveReturn: boolean) {
    const amt = parseFloat(approvedAmount)
    if (!amt || amt <= 0) { setError('Enter a valid amount.'); return }
    await doAction('APPROVE_PARTIAL', { approved_amount: amt, waive_return: waiveReturn, admin_notes: adminNotes || undefined })
  }

  async function closeSellerFavor() {
    await doAction('CLOSE_SELLER_FAVOR', { admin_notes: adminNotes || undefined })
  }

  async function waiveReturnApproveRefund() {
    if (!waiverReason) { setError('Select a waiver reason.'); return }
    const amt = parseFloat(approvedAmount)
    if (!amt || amt <= 0) { setError('Enter a valid amount.'); return }
    const fullNotes = `WAIVER REASON: ${waiverReason}\n\n${adminNotes}`.trim()
    await doAction('WAIVE_RETURN_APPROVE_REFUND', { approved_amount: amt, admin_notes: fullNotes })
  }

  async function releaseRefund() {
    const amt = parseFloat(approvedAmount)
    if (!amt || amt <= 0) { setError('Enter a valid amount.'); return }
    await doAction('RELEASE_REFUND', { approved_amount: amt })
  }

  async function postMessage() {
    if (!adminMessage.trim()) { setError('Message cannot be empty.'); return }
    await doAction('POST_MESSAGE', { message: adminMessage.trim() })
    setAdminMessage('')
  }

  function togglePanel(name: string) {
    setActivePanel((prev) => (prev === name ? null : name))
    setError(null)
  }

  if (isResolved) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800/50 dark:bg-green-900/20">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
          <p className="font-semibold text-sm text-green-800 dark:text-green-300">
            This dispute has been resolved.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive flex items-start gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800/50 dark:bg-green-900/20 dark:text-green-300 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          {success}
        </div>
      )}

      {/* ── Approve full refund + return ─────────────────────────────────── */}
      <ActionRow
        icon={<CheckCircle2 className="h-4 w-4 text-green-500" />}
        label="Approve full refund — require return"
        sub="Generates return label, holds refund until seller confirms receipt"
        expanded={activePanel === 'full_refund'}
        onToggle={() => togglePanel('full_refund')}
      >
        <p className="text-sm text-muted-foreground mb-3">
          This will set status to RETURN_REQUESTED and email a prepaid label to the buyer.
          The refund will only be released after the seller confirms receipt.
        </p>
        <Button
          onClick={approveFullRefundWithReturn}
          disabled={isPending}
          className="w-full"
        >
          Approve + generate return label
        </Button>
      </ActionRow>

      {/* ── Approve partial ──────────────────────────────────────────────── */}
      <ActionRow
        icon={<DollarSign className="h-4 w-4 text-blue-500" />}
        label="Approve partial refund"
        sub="Specify amount. Optionally waive return for low-value items."
        expanded={activePanel === 'partial'}
        onToggle={() => togglePanel('partial')}
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1">Approved amount</label>
            <div className="relative max-w-[160px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <input
                type="number"
                value={approvedAmount}
                onChange={(e) => setApprovedAmount(e.target.value)}
                min="0.01"
                step="0.01"
                className="w-full rounded-lg border border-border bg-background pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Admin notes (optional)</label>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Internal notes..."
              rows={2}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => approvePartial(false)}
              disabled={isPending}
              variant="outline"
              className="flex-1"
            >
              Partial — require return
            </Button>
            <Button
              onClick={() => approvePartial(true)}
              disabled={isPending}
              className="flex-1"
            >
              Partial — buyer keeps item
            </Button>
          </div>
        </div>
      </ActionRow>

      {/* ── Close in seller favor ────────────────────────────────────────── */}
      <ActionRow
        icon={<XCircle className="h-4 w-4 text-neutral-500" />}
        label="Close in seller's favor — no refund"
        sub="Releases held funds to seller. Cannot be undone."
        expanded={activePanel === 'seller_favor'}
        onToggle={() => togglePanel('seller_favor')}
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1">Admin notes (optional)</label>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Reason for closing in seller's favor..."
              rows={3}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <Button
            onClick={closeSellerFavor}
            disabled={isPending}
            variant="destructive"
            className="w-full"
          >
            Close — no refund
          </Button>
        </div>
      </ActionRow>

      {/* ── Waive return + approve refund ────────────────────────────────── */}
      <ActionRow
        icon={<RotateCcw className="h-4 w-4 text-amber-500" />}
        label={`Waive return — approve refund anyway`}
        sub={`Only for items ≤$${RETURN_WAIVER_MAX_VALUE} or verified unsalvageable. Requires documented reason.`}
        expanded={activePanel === 'waive_return'}
        onToggle={() => togglePanel('waive_return')}
      >
        <div className="space-y-3">
          {!canWaiveReturn && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-300">
              This item is valued at ${Number(dispute.claimed_amount).toFixed(2)}, above the $
              {RETURN_WAIVER_MAX_VALUE} waiver threshold. Approving will be logged and flagged.
            </div>
          )}
          <div>
            <label className="block text-xs font-medium mb-1">Waiver reason *</label>
            <div className="space-y-1">
              {WAIVER_REASONS.map((r) => (
                <label key={r} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="radio"
                    name="waiver_reason"
                    checked={waiverReason === r}
                    onChange={() => setWaiverReason(r)}
                    className="accent-foreground"
                  />
                  {r}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Approved amount</label>
            <div className="relative max-w-[160px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <input
                type="number"
                value={approvedAmount}
                onChange={(e) => setApprovedAmount(e.target.value)}
                min="0.01"
                step="0.01"
                className="w-full rounded-lg border border-border bg-background pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Additional notes</label>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Document your reasoning..."
              rows={2}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <Button
            onClick={waiveReturnApproveRefund}
            disabled={isPending}
            className="w-full"
          >
            Waive return + release refund
          </Button>
        </div>
      </ActionRow>

      {/* ── Release refund (after return confirmed) ───────────────────────── */}
      {['RETURN_RECEIVED'].includes(dispute.status) && (
        <ActionRow
          icon={<CheckCircle2 className="h-4 w-4 text-green-500" />}
          label="Release refund to buyer"
          sub="Item has been returned. Release the refund now."
          expanded={activePanel === 'release_refund'}
          onToggle={() => togglePanel('release_refund')}
        >
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1">Refund amount</label>
              <div className="relative max-w-[160px]">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <input
                  type="number"
                  value={approvedAmount}
                  onChange={(e) => setApprovedAmount(e.target.value)}
                  min="0.01"
                  step="0.01"
                  className="w-full rounded-lg border border-border bg-background pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            <Button onClick={releaseRefund} disabled={isPending} className="w-full">
              Release refund
            </Button>
          </div>
        </ActionRow>
      )}

      {/* ── Admin message ─────────────────────────────────────────────────── */}
      <div className="pt-1">
        <p className="text-xs font-medium mb-2 text-muted-foreground">
          Send a message to both parties
        </p>
        <div className="flex gap-2">
          <textarea
            value={adminMessage}
            onChange={(e) => setAdminMessage(e.target.value)}
            placeholder="Type a message as Reswell Team..."
            rows={2}
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button
            onClick={postMessage}
            disabled={!adminMessage.trim() || isPending}
            size="sm"
            className="self-end"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Collapsible action row
// ─────────────────────────────────────────────────────────────────────────────

function ActionRow({
  icon,
  label,
  sub,
  expanded,
  onToggle,
  children,
}: {
  icon: React.ReactNode
  label: string
  sub: string
  expanded: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border">
      <button
        className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-muted/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex-shrink-0 mt-0.5">{icon}</div>
          <div className="min-w-0">
            <p className="text-sm font-medium">{label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        )}
      </button>
      {expanded && <div className="border-t px-4 py-4">{children}</div>}
    </div>
  )
}
