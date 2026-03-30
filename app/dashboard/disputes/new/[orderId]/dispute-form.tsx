'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ShieldAlert,
  ShieldCheck,
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  Package,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  DISPUTE_REASON_LABELS,
  DISPUTE_REASON_DESCRIPTIONS,
  DISPUTE_REASON_GUARANTEE,
  DISPUTE_RESOLUTION_LABELS,
  SURF_DAMAGE_TYPES,
  MIN_DESCRIPTION_CHARS,
  MAX_EVIDENCE_PHOTOS,
  MIN_EVIDENCE_PHOTOS,
  type DisputeReason,
  type DisputeResolution,
} from '@/lib/disputes/constants'

type OrderInfo = {
  id: string
  amount: number
  shipping_cost: number | null
  listing_title: string
  listing_section: string | null
  listing_slug: string | null
  is_large_item: boolean
}

interface DisputeFormProps {
  order: OrderInfo
}

const REASONS: DisputeReason[] = [
  'NOT_RECEIVED',
  'NOT_AS_DESCRIBED',
  'DAMAGED',
  'WRONG_ITEM',
  'OTHER',
]

const RESOLUTIONS: DisputeResolution[] = [
  'FULL_REFUND',
  'PARTIAL_REFUND',
  'REPLACEMENT',
  'FLAG_ONLY',
]

export function DisputeForm({ order }: DisputeFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [reason, setReason] = useState<DisputeReason | null>(null)
  const [resolution, setResolution] = useState<DisputeResolution>('FULL_REFUND')
  const [description, setDescription] = useState('')
  const [claimedAmount, setClaimedAmount] = useState<string>(
    order.amount.toFixed(2)
  )
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([])
  const [evidenceInput, setEvidenceInput] = useState('')
  const [damageTypes, setDamageTypes] = useState<string[]>([])
  const [duringShipping, setDuringShipping] = useState<'YES' | 'NO' | 'UNSURE' | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [disputeId, setDisputeId] = useState<string | null>(null)

  const descLen = description.trim().length
  const descValid = descLen >= MIN_DESCRIPTION_CHARS
  const photosRequired = reason !== null && reason !== 'NOT_RECEIVED'
  const photosValid = !photosRequired || evidenceUrls.length >= MIN_EVIDENCE_PHOTOS
  const guarantee = reason ? DISPUTE_REASON_GUARANTEE[reason] : null

  function addEvidenceUrl() {
    const trimmed = evidenceInput.trim()
    if (!trimmed || evidenceUrls.length >= MAX_EVIDENCE_PHOTOS) return
    setEvidenceUrls((prev) => [...prev, trimmed])
    setEvidenceInput('')
  }

  function removeEvidence(idx: number) {
    setEvidenceUrls((prev) => prev.filter((_, i) => i !== idx))
  }

  function toggleDamageType(type: string) {
    setDamageTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    )
  }

  function canAdvanceStep1(): boolean {
    return reason !== null
  }

  function canAdvanceStep2(): boolean {
    return (
      descValid &&
      photosValid &&
      !!resolution &&
      parseFloat(claimedAmount) > 0
    )
  }

  async function handleSubmit() {
    setError(null)
    startTransition(async () => {
      try {
        const res = await fetch('/api/disputes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_id: order.id,
            reason,
            description,
            desired_resolution: resolution,
            claimed_amount: parseFloat(claimedAmount),
            evidence_urls: evidenceUrls,
            damage_types: damageTypes,
            damage_during_shipping: duringShipping,
            confirmed,
          }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error ?? 'Something went wrong.')
          return
        }
        setDisputeId(data.dispute_id)
        setSuccess(true)
      } catch {
        setError('Network error. Please try again.')
      }
    })
  }

  if (success && disputeId) {
    return (
      <Card>
        <CardContent className="py-12 flex flex-col items-center gap-5 text-center">
          <div className="rounded-full bg-green-100 p-4 dark:bg-green-900/30">
            <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-lg font-semibold">Dispute opened</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              The seller has 48 hours to respond. You'll be notified as soon as they do.
            </p>
          </div>
          <Button onClick={() => router.push(`/dashboard/disputes/${disputeId}`)}>
            Track your dispute <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {([1, 2, 3] as const).map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
                step === s
                  ? 'bg-foreground text-background'
                  : step > s
                  ? 'bg-green-500 text-white'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {step > s ? <CheckCircle2 className="h-4 w-4" /> : s}
            </div>
            {s < 3 && <div className="h-px w-8 bg-border" />}
          </div>
        ))}
        <span className="ml-2 text-muted-foreground">
          {step === 1 ? 'What happened?' : step === 2 ? 'Evidence & details' : 'Confirm'}
        </span>
      </div>

      {/* ── Step 1: Reason ──────────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <p className="font-semibold mb-3">What went wrong with your order?</p>
            <div className="space-y-2">
              {REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setReason(r)}
                  className={cn(
                    'w-full text-left rounded-lg border p-4 transition-colors',
                    reason === r
                      ? 'border-foreground bg-foreground/5'
                      : 'border-border hover:border-foreground/40'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">{DISPUTE_REASON_LABELS[r]}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {DISPUTE_REASON_DESCRIPTIONS[r]}
                      </p>
                    </div>
                    {reason === r && (
                      <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Guarantee banner */}
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
                    'h-5 w-5 flex-shrink-0 mt-0.5',
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

          {/* Large item note */}
          {order.is_large_item && reason && reason !== 'NOT_RECEIVED' && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/50 dark:bg-amber-900/20">
              <div className="flex items-start gap-3">
                <Package className="h-5 w-5 flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  Due to the size of this item, we'll arrange a freight pickup at no cost to you.
                  Our team will contact you within 24 hours to schedule.
                </p>
              </div>
            </div>
          )}

          <Button
            onClick={() => setStep(2)}
            disabled={!canAdvanceStep1()}
            className="w-full"
          >
            Continue <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}

      {/* ── Step 2: Evidence & details ───────────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-5">
          {/* Surf-specific damage types */}
          {(reason === 'DAMAGED' || reason === 'NOT_AS_DESCRIBED') && (
            <div>
              <p className="font-semibold text-sm mb-2">
                Damage type <span className="text-muted-foreground font-normal">(select all that apply)</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {SURF_DAMAGE_TYPES.map((dt) => (
                  <button
                    key={dt}
                    onClick={() => toggleDamageType(dt)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                      damageTypes.includes(dt)
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-border hover:border-foreground/40'
                    )}
                  >
                    {dt}
                  </button>
                ))}
              </div>

              <div className="mt-4">
                <p className="text-sm font-medium mb-2">Did the damage appear to happen during shipping?</p>
                <div className="flex gap-2">
                  {(['YES', 'NO', 'UNSURE'] as const).map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setDuringShipping(opt)}
                      className={cn(
                        'rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                        duringShipping === opt
                          ? 'border-foreground bg-foreground text-background'
                          : 'border-border hover:border-foreground/40'
                      )}
                    >
                      {opt === 'YES' ? 'Yes' : opt === 'NO' ? 'No' : 'Unsure'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold mb-1.5">
              Describe the issue
              <span className="text-muted-foreground font-normal ml-1">
                (min {MIN_DESCRIPTION_CHARS} characters)
              </span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain what happened in detail — be specific about the condition of the item, what was advertised, and what you received."
              rows={5}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p
              className={cn(
                'text-xs mt-1',
                descValid ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
              )}
            >
              {descLen} / {MIN_DESCRIPTION_CHARS} characters{descValid ? ' ✓' : ' minimum'}
            </p>
          </div>

          {/* Photo evidence */}
          {photosRequired && (
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <label className="text-sm font-semibold">
                  Photos
                  <span className="text-red-500 ml-0.5">*</span>
                </label>
                <span className="text-xs text-muted-foreground">
                  {MIN_EVIDENCE_PHOTOS} required · up to {MAX_EVIDENCE_PHOTOS}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Upload photos showing the issue. These are required to process your dispute.
              </p>

              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={evidenceInput}
                  onChange={(e) => setEvidenceInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addEvidenceUrl()}
                  placeholder="Paste photo URL..."
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addEvidenceUrl}
                  disabled={!evidenceInput.trim() || evidenceUrls.length >= MAX_EVIDENCE_PHOTOS}
                >
                  <Upload className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>

              {evidenceUrls.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                  {evidenceUrls.map((url, idx) => (
                    <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`Evidence ${idx + 1}`}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/placeholder-image.png'
                        }}
                      />
                      <button
                        onClick={() => removeEvidence(idx)}
                        className="absolute top-1 right-1 rounded-full bg-black/60 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {!photosValid && (
                <p className="text-xs text-orange-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {MIN_EVIDENCE_PHOTOS - evidenceUrls.length} more photo{MIN_EVIDENCE_PHOTOS - evidenceUrls.length > 1 ? 's' : ''} required
                </p>
              )}
            </div>
          )}

          {/* Desired resolution */}
          <div>
            <p className="font-semibold text-sm mb-2">What would you like?</p>
            <div className="space-y-2">
              {RESOLUTIONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setResolution(r)}
                  className={cn(
                    'w-full text-left rounded-lg border p-3 transition-colors text-sm',
                    resolution === r
                      ? 'border-foreground bg-foreground/5'
                      : 'border-border hover:border-foreground/40'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span>{DISPUTE_RESOLUTION_LABELS[r]}</span>
                    {resolution === r && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Claimed amount */}
          {(resolution === 'FULL_REFUND' || resolution === 'PARTIAL_REFUND') && (
            <div>
              <label className="block text-sm font-semibold mb-1.5">
                Amount you're requesting
              </label>
              <div className="relative max-w-[160px]">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <input
                  type="number"
                  value={claimedAmount}
                  onChange={(e) => setClaimedAmount(e.target.value)}
                  min="0.01"
                  step="0.01"
                  className="w-full rounded-lg border border-border bg-background pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
              Back
            </Button>
            <Button
              onClick={() => setStep(3)}
              disabled={!canAdvanceStep2()}
              className="flex-1"
            >
              Continue <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Confirm ───────────────────────────────────────────────────── */}
      {step === 3 && reason && (
        <div className="space-y-5">
          {/* Summary card */}
          <Card>
            <CardContent className="pt-4 pb-4 space-y-3">
              <p className="text-sm font-semibold">Dispute summary</p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Order</span>
                  <span className="font-medium text-right max-w-[200px] truncate">
                    {order.listing_title}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Reason</span>
                  <span>{DISPUTE_REASON_LABELS[reason]}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Requested</span>
                  <span>{DISPUTE_RESOLUTION_LABELS[resolution]}</span>
                </div>
                {(resolution === 'FULL_REFUND' || resolution === 'PARTIAL_REFUND') && (
                  <div className="flex justify-between font-semibold">
                    <span className="text-muted-foreground">Amount</span>
                    <span>${parseFloat(claimedAmount).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Photos</span>
                  <span>{evidenceUrls.length} uploaded</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Guarantee banner for selected reason */}
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
                    'h-5 w-5 flex-shrink-0 mt-0.5',
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

          {/* Confirmation checkbox */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border accent-foreground"
            />
            <span className="text-sm text-muted-foreground leading-relaxed">
              I understand that to receive a refund I may be required to return the item to the
              seller using a free prepaid label provided by Reswell. I confirm this claim is
              accurate and made in good faith.
            </span>
          </label>

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive flex items-start gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
              Back
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!confirmed || isPending}
              className="flex-1"
            >
              {isPending ? 'Submitting...' : 'Open dispute'}
              {!isPending && <ShieldAlert className="h-4 w-4 ml-1.5" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
