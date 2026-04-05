'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ShieldCheck, Upload, AlertCircle, CheckCircle2, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  CLAIM_TYPE_LABELS,
  CLAIM_TYPE_DESCRIPTIONS,
  MIN_DESCRIPTION_CHARS,
  MAX_EVIDENCE_FILES,
  type ClaimType,
} from '@/lib/protection-constants'
import { cn } from '@/lib/utils'

type PurchaseInfo = {
  id: string
  amount: number
  listing_title: string
}

interface ClaimFormProps {
  purchase: PurchaseInfo
}

const CLAIM_TYPES: ClaimType[] = [
  'NOT_RECEIVED',
  'NOT_AS_DESCRIBED',
  'DAMAGED',
  'UNAUTHORIZED',
]

export function ClaimForm({ purchase }: ClaimFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Form state
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [claimType, setClaimType] = useState<ClaimType | null>(null)
  const [description, setDescription] = useState('')
  const [claimedAmount, setClaimedAmount] = useState<string>(purchase.amount.toFixed(2))
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([])
  const [evidenceInput, setEvidenceInput] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [newClaimId, setNewClaimId] = useState<string | null>(null)

  const descLen = description.trim().length
  const descValid = descLen >= MIN_DESCRIPTION_CHARS
  const amountValid = parseFloat(claimedAmount) > 0

  function addEvidenceUrl() {
    const trimmed = evidenceInput.trim()
    if (!trimmed) return
    if (evidenceUrls.length >= MAX_EVIDENCE_FILES) return
    setEvidenceUrls((prev) => [...prev, trimmed])
    setEvidenceInput('')
  }

  function removeEvidence(idx: number) {
    setEvidenceUrls((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit() {
    setError(null)
    startTransition(async () => {
      try {
        const res = await fetch('/api/protection/claims', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_id: purchase.id,
            claim_type: claimType,
            description,
            claimed_amount: parseFloat(claimedAmount),
            evidence_urls: evidenceUrls,
            confirmed,
          }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error ?? 'Something went wrong. Please try again.')
          return
        }
        setNewClaimId(data.claim_id)
        setSuccess(true)
      } catch {
        setError('Network error. Please try again.')
      }
    })
  }

  if (success && newClaimId) {
    return (
      <div className="flex flex-col items-center gap-6 py-8 text-center">
        <div className="rounded-full bg-green-100 p-4 dark:bg-green-900/30">
          <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Claim received</h2>
          <p className="text-muted-foreground mt-2 max-w-sm">
            We&apos;ve notified the seller and will review your claim within 3 business days.
            You&apos;ll receive an email at each stage.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 justify-center">
          <Button asChild>
            <Link href={`/dashboard/claims/${newClaimId}`}>View my claim</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/claims">All claims</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Progress indicator */}
      <div className="flex items-center gap-2 text-sm">
        {(['What happened', 'Details', 'Review & submit'] as const).map((label, i) => {
          const stepNum = (i + 1) as 1 | 2 | 3
          const active = step === stepNum
          const done = step > stepNum
          return (
            <div key={label} className="flex items-center gap-1.5">
              <span
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
                  done
                    ? 'bg-green-600 text-white'
                    : active
                      ? 'bg-foreground text-background'
                      : 'bg-muted text-muted-foreground'
                )}
              >
                {done ? '✓' : stepNum}
              </span>
              <span
                className={cn(
                  active ? 'font-semibold text-foreground' : 'text-muted-foreground'
                )}
              >
                {label}
              </span>
              {i < 2 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </div>
          )
        })}
      </div>

      {/* ─── Step 1: Claim type ─── */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">What happened?</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Select the issue that best describes your situation.
            </p>
          </div>
          <div className="space-y-3">
            {CLAIM_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setClaimType(type)}
                className={cn(
                  'w-full text-left rounded-xl border p-4 transition-all',
                  claimType === type
                    ? 'border-foreground bg-secondary ring-1 ring-foreground'
                    : 'border-border bg-card hover:border-foreground/50 hover:bg-secondary/50'
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      'mt-0.5 h-4 w-4 flex-shrink-0 rounded-full border-2',
                      claimType === type
                        ? 'border-foreground bg-foreground'
                        : 'border-muted-foreground'
                    )}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{CLAIM_TYPE_LABELS[type]}</p>
                      {type === 'NOT_RECEIVED' && (
                        <Badge className="bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800/40 text-xs">
                          100% guaranteed
                        </Badge>
                      )}
                      {type !== 'NOT_RECEIVED' && (
                        <Badge className="bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800/40 text-xs">
                          every dollar back
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {CLAIM_TYPE_DESCRIPTIONS[type]}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* What's not covered */}
          <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800/40 dark:bg-amber-950/20">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1.5">
                Not covered:
              </p>
              <ul className="text-xs text-amber-700/80 dark:text-amber-400/80 space-y-0.5 list-disc list-inside">
                <li>Changed your mind / buyer&apos;s remorse</li>
                <li>Item matches description but you expected more</li>
                <li>Damage you caused after receiving the item</li>
                <li>Local pickup orders (no tracked shipping)</li>
                <li>Payments made outside Reswell</li>
                <li>Claims after 30 days from confirmed delivery</li>
              </ul>
            </CardContent>
          </Card>

          <Button
            className="w-full"
            disabled={!claimType}
            onClick={() => setStep(2)}
          >
            Continue
          </Button>
        </div>
      )}

      {/* ─── Step 2: Description + evidence ─── */}
      {step === 2 && claimType && (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold">Tell us what happened</h2>
            <p className="text-sm text-muted-foreground mt-1">
              The more detail you provide, the faster we can resolve your claim.
            </p>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label htmlFor="desc" className="text-sm font-medium">
              Description{' '}
              <span className="text-muted-foreground font-normal">
                (min {MIN_DESCRIPTION_CHARS} characters)
              </span>
            </label>
            <textarea
              id="desc"
              rows={5}
              placeholder="Describe what happened in detail — include dates, what was communicated with the seller, and any tracking info you have."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p
              className={cn(
                'text-xs text-right',
                descValid ? 'text-green-600' : 'text-muted-foreground'
              )}
            >
              {descLen} / {MIN_DESCRIPTION_CHARS} min
            </p>
          </div>

          {/* Claimed amount */}
          <div className="space-y-1.5">
            <label htmlFor="amount" className="text-sm font-medium">
              How much are you claiming?
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                $
              </span>
              <input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                max={purchase.amount}
                value={claimedAmount}
                onChange={(e) => setClaimedAmount(e.target.value)}
                className="w-full rounded-lg border bg-background pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <p className="text-xs text-green-600 dark:text-green-400">
              Full refund — every dollar you paid, item price and shipping. No cap.
            </p>
          </div>

          {/* Evidence */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Evidence{' '}
              <span className="text-muted-foreground font-normal">
                (up to {MAX_EVIDENCE_FILES} files — optional but recommended)
              </span>
            </label>
            <p className="text-xs text-muted-foreground">
              Paste public URLs to photos, screenshots, or tracking pages.
            </p>
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://..."
                value={evidenceInput}
                onChange={(e) => setEvidenceInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addEvidenceUrl())}
                className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addEvidenceUrl}
                disabled={!evidenceInput.trim() || evidenceUrls.length >= MAX_EVIDENCE_FILES}
              >
                <Upload className="h-4 w-4 mr-1.5" />
                Add
              </Button>
            </div>
            {evidenceUrls.length > 0 && (
              <ul className="space-y-1 mt-1">
                {evidenceUrls.map((url, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 text-xs rounded-md bg-secondary px-3 py-1.5"
                  >
                    <span className="flex-1 truncate text-foreground">{url}</span>
                    <button
                      type="button"
                      onClick={() => removeEvidence(i)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button
              className="flex-1"
              disabled={!descValid || !amountValid}
              onClick={() => setStep(3)}
            >
              Review claim
            </Button>
          </div>
        </div>
      )}

      {/* ─── Step 3: Review & confirm ─── */}
      {step === 3 && claimType && (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold">Review your claim</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Confirm everything is accurate before submitting.
            </p>
          </div>

          <Card>
            <CardContent className="pt-5 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Order</span>
                <span className="font-medium">{purchase.listing_title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Claim type</span>
                <span className="font-medium">{CLAIM_TYPE_LABELS[claimType]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount claimed</span>
                <span className="font-semibold">${parseFloat(claimedAmount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-green-600 dark:text-green-400">Coverage</span>
                <span className="text-green-600 dark:text-green-400 font-medium">
                  Full refund — every dollar paid
                </span>
              </div>
              <div className="border-t pt-3">
                <p className="text-muted-foreground mb-1">Description</p>
                <p className="text-foreground text-xs leading-relaxed">{description}</p>
              </div>
              {evidenceUrls.length > 0 && (
                <div className="border-t pt-3">
                  <p className="text-muted-foreground mb-1">
                    Evidence ({evidenceUrls.length} file{evidenceUrls.length > 1 ? 's' : ''})
                  </p>
                  <ul className="space-y-0.5">
                    {evidenceUrls.map((url, i) => (
                      <li key={i} className="text-xs text-blue-600 dark:text-blue-400 truncate">
                        {url}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Legal confirmation */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-border accent-foreground cursor-pointer"
            />
            <span className="text-sm text-foreground leading-relaxed">
              I confirm this claim is accurate and made in good faith. I understand that
              submitting a fraudulent claim may result in account suspension and legal action.
            </span>
          </label>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button
              className="flex-1"
              disabled={!confirmed || isPending}
              onClick={handleSubmit}
            >
              <ShieldCheck className="h-4 w-4 mr-2" />
              {isPending ? 'Submitting…' : 'Submit claim'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
