'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ShieldCheck,
  ShieldAlert,
  Package,
  Truck,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Upload,
  Send,
  DollarSign,
  Clock,
  X,
  Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  DISPUTE_REASON_LABELS,
  DISPUTE_STATUS_LABELS,
  DISPUTE_STATUS_COLORS,
  DISPUTE_RESOLUTION_LABELS,
  DISPUTE_REASON_GUARANTEE,
  isDisputeResolved,
  isInReturnFlow,
  type DisputeReason,
  type DisputeStatus,
} from '@/lib/disputes/constants'
import type { Dispute, DisputeMessage, DisputeEvidence } from '@/lib/disputes/types'

type OrderInfo = {
  id: string
  amount: number
  shipping_cost: number | null
  listing_title: string
  listing_slug: string | null
  listing_section: string | null
}

interface DisputeDetailClientProps {
  dispute: Dispute
  messages: DisputeMessage[]
  evidence: DisputeEvidence[]
  order: OrderInfo | null
  viewerRole: 'buyer' | 'seller'
  viewerId: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Return tracker component
// ─────────────────────────────────────────────────────────────────────────────

function ReturnTracker({ dispute }: { dispute: Dispute }) {
  const steps = [
    { key: 'label', label: 'Label sent', done: !!dispute.return_label_url },
    { key: 'shipped', label: 'Item shipped', done: !!dispute.return_tracking },
    {
      key: 'received',
      label: 'Item received',
      done: !!dispute.return_received_at || dispute.status === 'RETURN_RECEIVED',
    },
    {
      key: 'refund',
      label: 'Refund released',
      done: dispute.status === 'RESOLVED_REFUND',
    },
  ]

  const activeIdx = steps.findLastIndex((s) => s.done)

  return (
    <div className="relative">
      <div className="flex items-center justify-between">
        {steps.map((step, idx) => (
          <div key={step.key} className="flex flex-col items-center flex-1 relative">
            {/* Connecting line */}
            {idx < steps.length - 1 && (
              <div
                className={cn(
                  'absolute top-4 left-1/2 w-full h-0.5',
                  step.done ? 'bg-green-400' : 'bg-border'
                )}
              />
            )}
            <div
              className={cn(
                'relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold',
                step.done
                  ? 'border-green-500 bg-green-500 text-white'
                  : idx === activeIdx + 1
                  ? 'border-orange-400 bg-orange-50 text-orange-600 dark:bg-orange-900/30'
                  : 'border-border bg-background text-muted-foreground'
              )}
            >
              {step.done ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
            </div>
            <p
              className={cn(
                'mt-2 text-center text-xs',
                step.done
                  ? 'text-green-600 dark:text-green-400 font-medium'
                  : idx === activeIdx + 1
                  ? 'text-orange-600 dark:text-orange-400'
                  : 'text-muted-foreground'
              )}
            >
              {step.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function DisputeDetailClient({
  dispute: initialDispute,
  messages: initialMessages,
  evidence: initialEvidence,
  order,
  viewerRole,
  viewerId,
}: DisputeDetailClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [dispute, setDispute] = useState(initialDispute)
  const [messages, setMessages] = useState(initialMessages)

  // Message compose
  const [messageText, setMessageText] = useState('')

  // Return tracking
  const [trackingInput, setTrackingInput] = useState('')
  const [showTrackingInput, setShowTrackingInput] = useState(false)

  // Seller actions
  const [showPartialInput, setShowPartialInput] = useState(false)
  const [partialAmount, setPartialAmount] = useState('')
  const [showCounterInput, setShowCounterInput] = useState(false)
  const [counterMessage, setCounterMessage] = useState('')

  // Confirm return
  const [showReturnConditionFlag, setShowReturnConditionFlag] = useState(false)
  const [returnConditionMessage, setReturnConditionMessage] = useState('')

  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const isResolved = isDisputeResolved(dispute.status)
  const inReturnFlow = isInReturnFlow(dispute.status)
  const guarantee = DISPUTE_REASON_GUARANTEE[dispute.reason as DisputeReason]

  async function doAction(action: string, extra: Record<string, unknown> = {}) {
    setActionError(null)
    setActionSuccess(null)
    startTransition(async () => {
      try {
        const res = await fetch(`/api/disputes/${dispute.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, ...extra }),
        })
        const data = await res.json()
        if (!res.ok) {
          setActionError(data.error ?? 'Something went wrong.')
          return
        }
        setDispute((prev) => ({ ...prev, status: data.status }))
        setActionSuccess('Updated successfully.')
        router.refresh()
      } catch {
        setActionError('Network error. Please try again.')
      }
    })
  }

  async function sendMessage() {
    if (!messageText.trim()) return
    startTransition(async () => {
      const res = await fetch(`/api/disputes/${dispute.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText.trim() }),
      })
      if (res.ok) {
        const data = await res.json()
        setMessages((prev) => [...prev, data.message])
        setMessageText('')
      }
    })
  }

  // ── Seller-specific actions ──────────────────────────────────────────────

  async function sellerAcceptReturn() {
    await doAction('ACCEPT_RETURN')
  }

  async function sellerProposePartial() {
    const amt = parseFloat(partialAmount)
    if (!amt || amt <= 0) {
      setActionError('Enter a valid amount.')
      return
    }
    await doAction('PROPOSE_PARTIAL', { partial_amount: amt })
    setShowPartialInput(false)
    setPartialAmount('')
  }

  async function sellerDisputeClaim() {
    if (!counterMessage.trim()) {
      setActionError('Please describe your counter-claim.')
      return
    }
    await doAction('DISPUTE_CLAIM', { counter_message: counterMessage })
    setShowCounterInput(false)
    setCounterMessage('')
  }

  async function sellerConfirmReturn() {
    await doAction('CONFIRM_RETURN_ACCEPTABLE')
  }

  async function sellerFlagReturn() {
    if (!returnConditionMessage.trim()) {
      setActionError('Please describe the condition issue.')
      return
    }
    await doAction('FLAG_RETURN_CONDITION', { message: returnConditionMessage })
    setShowReturnConditionFlag(false)
    setReturnConditionMessage('')
  }

  // ── Buyer-specific actions ───────────────────────────────────────────────

  async function buyerAddTracking() {
    if (!trackingInput.trim()) {
      setActionError('Enter your tracking number.')
      return
    }
    await doAction('ADD_TRACKING', { tracking_number: trackingInput.trim() })
    setShowTrackingInput(false)
    setTrackingInput('')
  }

  async function buyerAcceptPartial() {
    await doAction('ACCEPT_PARTIAL', { partial_amount: dispute.seller_partial_amount })
  }

  async function buyerRejectPartial() {
    await doAction('REJECT_PARTIAL')
  }

  async function buyerEscalate() {
    await doAction('ESCALATE')
  }

  return (
    <div className="space-y-6">
      {/* ── Status header ──────────────────────────────────────────────────── */}
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${DISPUTE_STATUS_COLORS[dispute.status]}`}
            >
              {DISPUTE_STATUS_LABELS[dispute.status]}
            </span>
            <span className="text-sm text-muted-foreground">
              {DISPUTE_REASON_LABELS[dispute.reason as DisputeReason]}
            </span>
          </div>
          {!isResolved && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              Deadline:{' '}
              {new Date(dispute.deadline_at).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          )}
        </div>

        {/* Next action hint */}
        {!isResolved && (
          <NextActionHint dispute={dispute} role={viewerRole} />
        )}
      </div>

      {/* ── Guarantee banner ──────────────────────────────────────────────── */}
      {guarantee && (
        <div
          className={cn(
            'rounded-lg border p-4',
            guarantee.color === 'green'
              ? 'border-green-200 bg-green-50 dark:border-green-800/50 dark:bg-green-900/20'
              : 'border-blue-200 bg-blue-50 dark:border-blue-800/50 dark:bg-blue-900/20'
          )}
        >
          <div className="flex items-start gap-3">
            <ShieldCheck
              className={cn(
                'h-5 w-5 flex-shrink-0',
                guarantee.color === 'green'
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-blue-600 dark:text-blue-400'
              )}
            />
            <div>
              <p
                className={cn(
                  'font-semibold text-sm',
                  guarantee.color === 'green'
                    ? 'text-green-800 dark:text-green-300'
                    : 'text-blue-800 dark:text-blue-300'
                )}
              >
                {guarantee.headline}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{guarantee.sub}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Return tracker ────────────────────────────────────────────────── */}
      {dispute.return_required && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Package className="h-4 w-4" /> Return tracker
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <ReturnTracker dispute={dispute} />
            {dispute.return_label_url && !dispute.return_tracking && (
              <a
                href={dispute.return_label_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 block"
              >
                <Button variant="outline" size="sm" className="w-full">
                  <Truck className="h-4 w-4 mr-2" /> Download return label
                </Button>
              </a>
            )}
            {dispute.return_tracking && (
              <p className="mt-3 text-sm text-muted-foreground">
                Tracking: <span className="font-mono text-foreground">{dispute.return_tracking}</span>
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Action buttons (role-based) ───────────────────────────────────── */}
      {!isResolved && (
        <div className="space-y-3">
          {actionError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive flex items-start gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              {actionError}
            </div>
          )}
          {actionSuccess && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800/50 dark:bg-green-900/20 dark:text-green-300 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              {actionSuccess}
            </div>
          )}

          {/* ── BUYER actions ── */}
          {viewerRole === 'buyer' && (
            <div className="space-y-3">
              {/* Add tracking */}
              {dispute.status === 'RETURN_REQUESTED' && (
                <div>
                  {!showTrackingInput ? (
                    <Button
                      onClick={() => setShowTrackingInput(true)}
                      className="w-full sm:w-auto"
                    >
                      <Truck className="h-4 w-4 mr-2" />
                      Enter return tracking number
                    </Button>
                  ) : (
                    <div className="rounded-lg border p-4 space-y-3">
                      <p className="text-sm font-semibold">Enter return tracking number</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={trackingInput}
                          onChange={(e) => setTrackingInput(e.target.value)}
                          placeholder="e.g. 1Z999AA10123456784"
                          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        <Button onClick={buyerAddTracking} disabled={isPending} size="sm">
                          Submit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowTrackingInput(false)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Accept partial offer */}
              {dispute.status === 'AWAITING_BUYER' && dispute.seller_partial_amount && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800/50 dark:bg-blue-900/20">
                  <div className="flex items-start gap-3 mb-3">
                    <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-sm text-blue-800 dark:text-blue-300">
                        Seller proposes ${Number(dispute.seller_partial_amount).toFixed(2)} partial refund
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        You would keep the item. No return required.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={buyerAcceptPartial}
                      disabled={isPending}
                      className="flex-1"
                    >
                      Accept ${Number(dispute.seller_partial_amount).toFixed(2)}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={buyerRejectPartial}
                      disabled={isPending}
                      className="flex-1"
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              )}

              {/* Escalate button */}
              {['AWAITING_BUYER', 'AWAITING_SELLER', 'OPEN'].includes(dispute.status) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={buyerEscalate}
                  disabled={isPending}
                >
                  <ShieldAlert className="h-4 w-4 mr-2" />
                  Escalate to Reswell team
                </Button>
              )}
            </div>
          )}

          {/* ── SELLER actions ── */}
          {viewerRole === 'seller' && (
            <div className="space-y-3">
              {/* Seller respond to new dispute */}
              {dispute.status === 'AWAITING_SELLER' && (
                <div className="space-y-3">
                  <p className="text-sm font-semibold">How would you like to respond?</p>

                  {/* Accept + return */}
                  <Button
                    onClick={sellerAcceptReturn}
                    disabled={isPending}
                    className="w-full justify-start"
                    variant="outline"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                    Accept — request item return
                  </Button>

                  {/* Propose partial */}
                  {!showPartialInput ? (
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => setShowPartialInput(true)}
                      disabled={isPending}
                    >
                      <DollarSign className="h-4 w-4 mr-2 text-blue-500" />
                      Propose partial refund (buyer keeps item)
                    </Button>
                  ) : (
                    <div className="rounded-lg border p-4 space-y-3">
                      <p className="text-sm font-semibold">Propose partial refund</p>
                      <div className="relative max-w-[160px]">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                        <input
                          type="number"
                          value={partialAmount}
                          onChange={(e) => setPartialAmount(e.target.value)}
                          min="0.01"
                          step="0.01"
                          placeholder="0.00"
                          className="w-full rounded-lg border border-border bg-background pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={sellerProposePartial} disabled={isPending}>
                          Send proposal
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setShowPartialInput(false); setPartialAmount('') }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Dispute claim */}
                  {!showCounterInput ? (
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => setShowCounterInput(true)}
                      disabled={isPending}
                    >
                      <AlertCircle className="h-4 w-4 mr-2 text-orange-500" />
                      Dispute this claim
                    </Button>
                  ) : (
                    <div className="rounded-lg border p-4 space-y-3">
                      <p className="text-sm font-semibold">Dispute this claim</p>
                      <p className="text-xs text-muted-foreground">
                        Explain why you believe this claim is inaccurate. Include any relevant photos or evidence in the message thread below.
                      </p>
                      <textarea
                        value={counterMessage}
                        onChange={(e) => setCounterMessage(e.target.value)}
                        placeholder="Describe why you're disputing this claim..."
                        rows={4}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={sellerDisputeClaim} disabled={isPending}>
                          Submit response
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setShowCounterInput(false); setCounterMessage('') }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Seller confirm return receipt */}
              {['RETURN_SHIPPED', 'RETURN_RECEIVED'].includes(dispute.status) && (
                <div className="space-y-3">
                  <p className="text-sm font-semibold">Has the item arrived?</p>

                  <Button
                    onClick={sellerConfirmReturn}
                    disabled={isPending}
                    className="w-full justify-start"
                    variant="outline"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                    Item received — condition acceptable
                    <span className="ml-auto text-xs text-muted-foreground">(releases refund)</span>
                  </Button>

                  {!showReturnConditionFlag ? (
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => setShowReturnConditionFlag(true)}
                      disabled={isPending}
                    >
                      <AlertCircle className="h-4 w-4 mr-2 text-orange-500" />
                      Item received — condition issue
                      <span className="ml-auto text-xs text-muted-foreground">(escalates to admin)</span>
                    </Button>
                  ) : (
                    <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-800/50 dark:bg-orange-900/20 space-y-3">
                      <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">
                        Describe the condition issue
                      </p>
                      <p className="text-xs text-muted-foreground">
                        This will escalate to the Reswell team for review. Include photos of the returned item in the message thread.
                      </p>
                      <textarea
                        value={returnConditionMessage}
                        onChange={(e) => setReturnConditionMessage(e.target.value)}
                        placeholder="Describe what is wrong with the returned item..."
                        rows={3}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={sellerFlagReturn} disabled={isPending}>
                          Escalate to Reswell
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setShowReturnConditionFlag(false); setReturnConditionMessage('') }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Resolution summary ─────────────────────────────────────────────── */}
      {isResolved && dispute.resolution_notes && (
        <Card className="border-green-200 bg-green-50 dark:border-green-800/50 dark:bg-green-900/10">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
              <div>
                <p className="font-semibold text-sm text-green-800 dark:text-green-300">
                  Dispute resolved
                </p>
                <p className="text-sm text-muted-foreground mt-1">{dispute.resolution_notes}</p>
                {dispute.approved_amount != null && (
                  <p className="text-sm font-semibold text-green-700 dark:text-green-400 mt-1">
                    {dispute.status === 'RESOLVED_REFUND'
                      ? `Refund: $${Number(dispute.approved_amount).toFixed(2)}`
                      : dispute.status === 'RESOLVED_KEEP_ITEM'
                      ? `Partial refund: $${Number(dispute.approved_amount).toFixed(2)}`
                      : null}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Message thread ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Messages
            <span className="text-xs font-normal text-muted-foreground">
              ({messages.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4 space-y-4">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No messages yet. Use this thread to communicate with the other party.
            </p>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {messages.map((msg) => {
                const isAdmin = msg.sender_role === 'ADMIN'
                const isMine =
                  (msg.sender_role === 'BUYER' && viewerRole === 'buyer') ||
                  (msg.sender_role === 'SELLER' && viewerRole === 'seller')

                return (
                  <div
                    key={msg.id}
                    className={cn(
                      'flex flex-col gap-1',
                      isMine ? 'items-end' : 'items-start'
                    )}
                  >
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {isAdmin && (
                        <span className="font-semibold text-blue-600 dark:text-blue-400">
                          Reswell Team
                        </span>
                      )}
                      {!isAdmin && (
                        <span className="font-medium">
                          {msg.sender_role === 'BUYER' ? 'Buyer' : 'Seller'}
                        </span>
                      )}
                      <span>·</span>
                      <span>
                        {new Date(msg.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div
                      className={cn(
                        'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm',
                        isAdmin
                          ? 'bg-blue-600 text-white rounded-bl-sm'
                          : isMine
                          ? 'bg-foreground text-background rounded-br-sm'
                          : 'bg-muted text-foreground rounded-bl-sm'
                      )}
                    >
                      {msg.message}
                    </div>
                    {msg.attachments?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {msg.attachments.map((url, i) => (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 underline dark:text-blue-400"
                          >
                            Photo {i + 1}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Compose */}
          {!isResolved && (
            <div className="flex gap-2 pt-2 border-t">
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage()
                  }
                }}
                placeholder="Type a message..."
                rows={2}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <Button
                onClick={sendMessage}
                disabled={!messageText.trim() || isPending}
                size="sm"
                className="self-end"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Evidence photos ────────────────────────────────────────────────── */}
      {initialEvidence.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Upload className="h-4 w-4" /> Evidence
              <span className="text-xs font-normal text-muted-foreground">
                ({initialEvidence.length} items)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {initialEvidence.map((ev) => (
                <a
                  key={ev.id}
                  href={ev.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="aspect-square rounded-lg overflow-hidden border bg-muted block"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={ev.url}
                    alt={ev.caption ?? 'Evidence'}
                    className="h-full w-full object-cover hover:opacity-90 transition-opacity"
                  />
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Next action hint banner
// ─────────────────────────────────────────────────────────────────────────────

function NextActionHint({
  dispute,
  role,
}: {
  dispute: Dispute
  role: 'buyer' | 'seller'
}) {
  const hints: Partial<Record<DisputeStatus, { buyer?: string; seller?: string }>> = {
    AWAITING_SELLER: {
      buyer: 'Waiting for the seller to respond. They have 48 hours.',
      seller: 'You have 48 hours to respond: accept the return, propose a partial refund, or dispute the claim.',
    },
    AWAITING_BUYER: {
      buyer: 'The seller has responded. Review their message and reply or escalate.',
      seller: 'Waiting for the buyer to respond.',
    },
    RETURN_REQUESTED: {
      buyer: 'Your free prepaid return label has been emailed to you. Ship the item within 5 days.',
      seller: 'Waiting for the buyer to ship the item back.',
    },
    RETURN_SHIPPED: {
      buyer: 'Your return is in transit. The refund will be released after the seller confirms receipt.',
      seller: 'The item is on its way back. Confirm receipt when it arrives.',
    },
    RETURN_RECEIVED: {
      buyer: 'The item has been received. The refund is being processed.',
      seller: 'Please confirm whether the item arrived in acceptable condition.',
    },
    UNDER_REVIEW: {
      buyer: 'Your dispute is under review by the Reswell team. We\'ll notify you when a decision is made.',
      seller: 'This dispute is under review by the Reswell team.',
    },
  }

  const hint = hints[dispute.status]?.[role]
  if (!hint) return null

  return (
    <div className="flex items-start gap-2 text-sm">
      <Info className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
      <p className="text-muted-foreground">{hint}</p>
    </div>
  )
}
