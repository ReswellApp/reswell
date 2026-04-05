'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { CheckCircle2, XCircle, Tag, Loader2, AlertCircle } from 'lucide-react'
import type { OfferRole, OfferStatus } from '@/lib/offers/types'
import { peerListingCheckoutHref } from '@/lib/listing-href'

interface OfferThreadActionsProps {
  offerId: string
  status: OfferStatus
  currentAmount: number
  askingPrice: number
  myRole: OfferRole
  counterCount: number
  listingSlug: string
  listingSection: string
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export function OfferThreadActions({
  offerId,
  status,
  currentAmount,
  askingPrice,
  myRole,
  counterCount,
  listingSlug,
  listingSection,
}: OfferThreadActionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [counterOpen, setCounterOpen] = useState(false)
  const [counterAmount, setCounterAmount] = useState('')
  const [counterNote, setCounterNote] = useState('')
  const [declineOpen, setDeclineOpen] = useState(false)
  const [declineNote, setDeclineNote] = useState('')

  const isBuyer = myRole === 'BUYER'
  const isSeller = myRole === 'SELLER'
  const minOffer = Math.ceil(askingPrice * 0.5 * 100) / 100

  async function respond(action: 'ACCEPT' | 'DECLINE' | 'WITHDRAW' | 'COUNTER', opts?: { amount?: number; note?: string }) {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/offers/${offerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...opts }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong.')
        return
      }

      if (action === 'ACCEPT') {
        router.push(peerListingCheckoutHref(listingSection, listingSlug, offerId))
      } else {
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  // ── Buyer: PENDING — can only withdraw ───────────────────────────
  if (isBuyer && status === 'PENDING') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Waiting for the seller to respond to your offer.</p>
        <Button
          variant="outline"
          className="text-destructive hover:text-destructive"
          onClick={() => respond('WITHDRAW')}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Withdraw offer
        </Button>
        {error && <ErrorMsg msg={error} />}
      </div>
    )
  }

  // ── Buyer: COUNTERED — can accept, decline, or counter ───────────
  if (isBuyer && status === 'COUNTERED') {
    return (
      <div className="space-y-4">
        <p className="text-sm font-medium">
          Seller countered at <strong>{fmt(currentAmount)}</strong>. How would you like to respond?
        </p>

        <div className="flex flex-wrap gap-2">
          <Button
            className="flex-1"
            onClick={() => respond('ACCEPT')}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
            Accept {fmt(currentAmount)}
          </Button>
          {counterCount < 3 && (
            <Button
              variant="outline"
              onClick={() => { setCounterOpen(!counterOpen); setDeclineOpen(false) }}
              disabled={loading}
            >
              <Tag className="h-4 w-4 mr-2" />
              Counter
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => { setDeclineOpen(!declineOpen); setCounterOpen(false) }}
            disabled={loading}
          >
            <XCircle className="h-4 w-4 mr-2" />
            Decline
          </Button>
        </div>

        {counterOpen && (
          <CounterForm
            value={counterAmount}
            note={counterNote}
            min={minOffer}
            max={askingPrice - 0.01}
            placeholder={fmt(Math.round(currentAmount * 1.05)).replace('$', '')}
            loading={loading}
            counterCount={counterCount}
            onChange={setCounterAmount}
            onNoteChange={setCounterNote}
            onSubmit={() => {
              const amt = parseFloat(counterAmount)
              if (!isNaN(amt)) respond('COUNTER', { amount: amt, note: counterNote.trim() || undefined })
            }}
            onCancel={() => setCounterOpen(false)}
          />
        )}

        {declineOpen && (
          <DeclineForm
            note={declineNote}
            loading={loading}
            onChange={setDeclineNote}
            onSubmit={() => respond('DECLINE', { note: declineNote.trim() || undefined })}
            onCancel={() => setDeclineOpen(false)}
          />
        )}

        {error && <ErrorMsg msg={error} />}
      </div>
    )
  }

  // ── Seller: PENDING — can accept, decline, or counter ────────────
  if (isSeller && status === 'PENDING') {
    return (
      <div className="space-y-4">
        <p className="text-sm font-medium">
          Buyer offered <strong>{fmt(currentAmount)}</strong>. How would you like to respond?
        </p>

        <div className="flex flex-wrap gap-2">
          <Button
            className="flex-1"
            onClick={() => respond('ACCEPT')}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
            Accept {fmt(currentAmount)}
          </Button>
          {counterCount < 3 && (
            <Button
              variant="outline"
              onClick={() => { setCounterOpen(!counterOpen); setDeclineOpen(false) }}
              disabled={loading}
            >
              <Tag className="h-4 w-4 mr-2" />
              Counter
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => { setDeclineOpen(!declineOpen); setCounterOpen(false) }}
            disabled={loading}
          >
            <XCircle className="h-4 w-4 mr-2" />
            Decline
          </Button>
        </div>

        {counterOpen && (
          <CounterForm
            value={counterAmount}
            note={counterNote}
            min={Number(currentAmount) + 0.01}
            max={askingPrice - 0.01}
            placeholder={fmt(Math.round((Number(currentAmount) + askingPrice) / 2)).replace('$', '')}
            loading={loading}
            counterCount={counterCount}
            onChange={setCounterAmount}
            onNoteChange={setCounterNote}
            onSubmit={() => {
              const amt = parseFloat(counterAmount)
              if (!isNaN(amt)) respond('COUNTER', { amount: amt, note: counterNote.trim() || undefined })
            }}
            onCancel={() => setCounterOpen(false)}
          />
        )}

        {declineOpen && (
          <DeclineForm
            note={declineNote}
            loading={loading}
            onChange={setDeclineNote}
            onSubmit={() => respond('DECLINE', { note: declineNote.trim() || undefined })}
            onCancel={() => setDeclineOpen(false)}
          />
        )}

        {error && <ErrorMsg msg={error} />}
      </div>
    )
  }

  // ── Seller: COUNTERED — waiting for buyer ─────────────────────────
  if (isSeller && status === 'COUNTERED') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          You countered at <strong>{fmt(currentAmount)}</strong>. Waiting for the buyer to respond.
        </p>
        <p className="text-xs text-muted-foreground">
          You can&apos;t take any action until the buyer responds.
        </p>
      </div>
    )
  }

  // ── ACCEPTED — checkout button ────────────────────────────────────
  if (status === 'ACCEPTED' && isBuyer) {
    return (
      <Button size="lg" className="w-full" asChild>
        <Link href={peerListingCheckoutHref(listingSection, listingSlug, offerId)}>
          Complete purchase — {fmt(currentAmount)}
        </Link>
      </Button>
    )
  }

  return null
}

function CounterForm({
  value,
  note,
  min,
  max,
  placeholder,
  loading,
  counterCount,
  onChange,
  onNoteChange,
  onSubmit,
  onCancel,
}: {
  value: string
  note: string
  min: number
  max: number
  placeholder: string
  loading: boolean
  counterCount: number
  onChange: (v: string) => void
  onNoteChange: (v: string) => void
  onSubmit: () => void
  onCancel: () => void
}) {
  return (
    <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
      <p className="text-sm font-medium">Your counter offer</p>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-md border border-input bg-background pl-7 pr-3 py-2.5 text-sm font-medium ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <Textarea
        placeholder="Add a note (optional, 200 char max)"
        value={note}
        onChange={(e) => onNoteChange(e.target.value.slice(0, 200))}
        rows={2}
        className="resize-none text-sm"
      />
      {counterCount >= 2 && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          ⚠️ This is your last counter-offer. After this the negotiation closes.
        </p>
      )}
      <div className="flex gap-2">
        <Button size="sm" className="flex-1" disabled={loading || !value} onClick={onSubmit}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
          Send counter
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}

function DeclineForm({
  note,
  loading,
  onChange,
  onSubmit,
  onCancel,
}: {
  note: string
  loading: boolean
  onChange: (v: string) => void
  onSubmit: () => void
  onCancel: () => void
}) {
  return (
    <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
      <p className="text-sm font-medium">Decline this offer</p>
      <Textarea
        placeholder="Optional note to the other party (e.g. 'Lowest I can go is $280, firm')"
        value={note}
        onChange={(e) => onChange(e.target.value.slice(0, 200))}
        rows={2}
        className="resize-none text-sm"
      />
      <div className="flex gap-2">
        <Button size="sm" variant="destructive" className="flex-1" disabled={loading} onClick={onSubmit}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
          Confirm decline
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
      {msg}
    </div>
  )
}
