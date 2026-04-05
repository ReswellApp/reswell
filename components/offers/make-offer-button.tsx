'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Tag,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react'
import type { Offer, OfferStatus } from '@/lib/offers/types'
import { CATEGORY_OFFER_HINTS, CONDITION_OFFER_HINTS } from '@/lib/offers/types'
import { peerListingCheckoutHref } from '@/lib/listing-href'

interface MakeOfferButtonProps {
  listingId: string
  listingTitle: string
  listingSlug: string
  listingSection: string
  askingPrice: number
  sellerId: string
  categorySlug?: string | null
  condition?: string | null
  localPickupCity?: string | null
  offersEnabled: boolean
  isLoggedIn: boolean
  /** The buyer's existing active offer on this listing, if any */
  activeOffer?: Offer | null
}

function pct(amount: number, asking: number) {
  return Math.round((amount / asking) * 100)
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function timeLeft(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return 'expired'
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function statusBadgeVariant(status: OfferStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'ACCEPTED') return 'default'
  if (status === 'DECLINED' || status === 'EXPIRED' || status === 'WITHDRAWN') return 'destructive'
  if (status === 'COUNTERED') return 'secondary'
  return 'outline'
}

export function MakeOfferButton({
  listingId,
  listingTitle,
  listingSlug,
  listingSection,
  askingPrice,
  sellerId,
  categorySlug,
  condition,
  localPickupCity,
  offersEnabled,
  isLoggedIn,
  activeOffer: initialOffer,
}: MakeOfferButtonProps) {
  const router = useRouter()

  const [open, setOpen] = useState(false)
  const [counterOpen, setCounterOpen] = useState(false)
  const [offer, setOffer] = useState<Offer | null>(initialOffer ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Offer form state
  const [offerAmount, setOfferAmount] = useState('')
  const [offerNote, setOfferNote] = useState(
    localPickupCity ? `I can do local pickup in ${localPickupCity}` : ''
  )

  // Counter form state
  const [counterAmount, setCounterAmount] = useState('')
  const [counterNote, setCounterNote] = useState('')

  const minOffer = Math.ceil(askingPrice * 0.5 * 100) / 100
  const categoryHint = categorySlug ? CATEGORY_OFFER_HINTS[categorySlug] : null
  const conditionHint = condition ? CONDITION_OFFER_HINTS[condition] : null

  const resetForm = useCallback(() => {
    setOfferAmount('')
    setOfferNote(localPickupCity ? `I can do local pickup in ${localPickupCity}` : '')
    setError(null)
    setSuccess(null)
  }, [localPickupCity])

  // ── Submit new offer ─────────────────────────────────────────────
  async function handleSubmitOffer() {
    const amount = parseFloat(offerAmount)
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid offer amount.')
      return
    }
    if (amount < minOffer) {
      setError(`Offers must be at least ${fmt(minOffer)} (50% of asking price).`)
      return
    }
    if (amount > askingPrice) {
      setError('Offer cannot exceed the asking price.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing_id: listingId,
          seller_id: sellerId,
          amount,
          note: offerNote.trim() || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong.')
        return
      }

      setOffer(data.offer)

      if (data.autoMessage) {
        setSuccess(data.autoMessage)
      } else if (data.status === 'ACCEPTED') {
        setSuccess('Your offer was accepted! Proceed to checkout.')
        setOpen(false)
      } else {
        setOpen(false)
      }

      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  // ── Respond to existing offer ─────────────────────────────────────
  async function respondToOffer(
    action: 'ACCEPT' | 'DECLINE' | 'WITHDRAW' | 'COUNTER',
    opts?: { amount?: number; note?: string }
  ) {
    if (!offer) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/offers/${offer.id}`, {
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
        setOffer({ ...offer, status: 'ACCEPTED', current_amount: data.agreedAmount })
        router.push(peerListingCheckoutHref(listingSection, listingSlug, offer.id))
      } else if (action === 'COUNTER') {
        setOffer({ ...offer, status: 'COUNTERED', current_amount: data.newAmount, counter_count: offer.counter_count + 1 })
        setCounterOpen(false)
        setCounterAmount('')
        setCounterNote('')
      } else {
        setOffer({ ...offer, status: data.status })
      }

      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  // ── No offers on this listing ────────────────────────────────────
  if (!offersEnabled) return null

  // ── Login gate ───────────────────────────────────────────────────
  if (!isLoggedIn) {
    return (
      <Button variant="outline" size="lg" className="w-full gap-2" asChild>
        <Link href={`/auth/login?redirect=${encodeURIComponent(`/${listingSection}/${listingSlug}`)}`}>
          <Tag className="h-4 w-4" />
          Make an offer
        </Link>
      </Button>
    )
  }

  // ── Show status banner if buyer has an active/past offer ──────────
  if (offer) {
    return (
      <OfferStatusBanner
        offer={offer}
        askingPrice={askingPrice}
        listingSlug={listingSlug}
        listingSection={listingSection}
        listingTitle={listingTitle}
        loading={loading}
        error={error}
        success={success}
        counterOpen={counterOpen}
        counterAmount={counterAmount}
        counterNote={counterNote}
        onSetCounterOpen={setCounterOpen}
        onSetCounterAmount={setCounterAmount}
        onSetCounterNote={setCounterNote}
        onRespond={respondToOffer}
        onMakeNew={() => {
          setOffer(null)
          resetForm()
          setOpen(true)
        }}
      />
    )
  }

  // ── Make offer button + modal ──────────────────────────────────────
  return (
    <>
      <Button
        variant="outline"
        size="lg"
        className="w-full gap-2"
        onClick={() => { resetForm(); setOpen(true) }}
      >
        <Tag className="h-4 w-4" />
        Make an offer
      </Button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setError(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Make an offer</DialogTitle>
            <DialogDescription className="line-clamp-1">{listingTitle}</DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* Asking price reference */}
            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3 text-sm">
              <span className="text-muted-foreground">Asking price</span>
              <span className="font-bold text-lg">{fmt(askingPrice)}</span>
            </div>

            {/* Amount input */}
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="offer-amount">
                Your offer
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                <input
                  id="offer-amount"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min={minOffer}
                  max={askingPrice}
                  value={offerAmount}
                  onChange={(e) => { setOfferAmount(e.target.value); setError(null) }}
                  placeholder={fmt(Math.round(askingPrice * 0.75)).replace('$', '')}
                  className="w-full rounded-md border border-input bg-background pl-7 pr-4 py-3 text-xl font-bold ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              {/* Range visual */}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{fmt(minOffer)} min</span>
                {offerAmount && !isNaN(parseFloat(offerAmount)) && (
                  <span className="font-medium text-foreground">
                    {pct(parseFloat(offerAmount), askingPrice)}% of asking
                  </span>
                )}
                <span>{fmt(askingPrice)} asking</span>
              </div>

              {/* Visual range bar */}
              <div className="relative h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="absolute left-0 top-0 h-full bg-primary/30 rounded-full" style={{ width: '50%' }} />
                {offerAmount && !isNaN(parseFloat(offerAmount)) && (
                  <div
                    className="absolute top-0 h-full w-1 bg-primary rounded-full -translate-x-1/2"
                    style={{
                      left: `${Math.min(100, Math.max(0, ((parseFloat(offerAmount) - minOffer) / (askingPrice - minOffer)) * 100))}%`
                    }}
                  />
                )}
              </div>
            </div>

            {/* Contextual hints */}
            {(categoryHint || conditionHint) && (
              <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground space-y-1">
                {categoryHint && <p>💡 {categoryHint.label} typically sell for <strong>{categoryHint.range}</strong></p>}
                {conditionHint && <p>📋 {conditionHint}</p>}
              </div>
            )}

            {/* Optional note */}
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="offer-note">
                Add a note <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <Textarea
                id="offer-note"
                placeholder={localPickupCity ? `I can do local pickup in ${localPickupCity}` : 'e.g. I can pick up locally in San Diego…'}
                value={offerNote}
                onChange={(e) => setOfferNote(e.target.value.slice(0, 200))}
                rows={2}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground text-right">{offerNote.length}/200</p>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            {success && (
              <div className="flex items-start gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                {success}
              </div>
            )}

            <Button
              className="w-full"
              size="lg"
              onClick={handleSubmitOffer}
              disabled={loading || !offerAmount}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Send offer
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              Your offer expires in 48 hours. If accepted, you&apos;ll have 24 hours to complete your purchase.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Offer Status Banner ──────────────────────────────────────────────────────

interface OfferStatusBannerProps {
  offer: Offer
  askingPrice: number
  listingSlug: string
  listingSection: string
  listingTitle: string
  loading: boolean
  error: string | null
  success: string | null
  counterOpen: boolean
  counterAmount: string
  counterNote: string
  onSetCounterOpen: (v: boolean) => void
  onSetCounterAmount: (v: string) => void
  onSetCounterNote: (v: string) => void
  onRespond: (action: 'ACCEPT' | 'DECLINE' | 'WITHDRAW' | 'COUNTER', opts?: { amount?: number; note?: string }) => void
  onMakeNew: () => void
}

function OfferStatusBanner({
  offer,
  askingPrice,
  listingSlug,
  listingSection,
  loading,
  error,
  counterOpen,
  counterAmount,
  counterNote,
  onSetCounterOpen,
  onSetCounterAmount,
  onSetCounterNote,
  onRespond,
  onMakeNew,
}: OfferStatusBannerProps) {
  const minOffer = Math.ceil(askingPrice * 0.5 * 100) / 100

  const bgColor = {
    PENDING:   'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800',
    COUNTERED: 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800',
    ACCEPTED:  'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800',
    DECLINED:  'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800',
    EXPIRED:   'bg-muted border-border',
    WITHDRAWN: 'bg-muted border-border',
    COMPLETED: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800',
  }[offer.status] ?? 'bg-muted border-border'

  return (
    <div className={`rounded-lg border p-4 space-y-3 ${bgColor}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Badge variant={statusBadgeVariant(offer.status)} className="text-xs">
              {offer.status}
            </Badge>
            <span className="text-sm font-semibold">
              {fmt(offer.current_amount)}
              <span className="text-xs font-normal text-muted-foreground ml-1">
                ({pct(offer.current_amount, askingPrice)}% of asking)
              </span>
            </span>
          </div>
          {['PENDING', 'COUNTERED', 'ACCEPTED'].includes(offer.status) && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <Clock className="h-3 w-3" />
              {offer.status === 'ACCEPTED' ? 'Pay within' : 'Expires in'} {timeLeft(offer.expires_at)}
            </p>
          )}
        </div>
        <Link
          href={`/offers/${offer.id}`}
          className="text-xs text-muted-foreground underline underline-offset-2 shrink-0"
        >
          View thread
        </Link>
      </div>

      {/* Status messages */}
      {offer.status === 'PENDING' && (
        <p className="text-sm text-muted-foreground">
          Your offer is awaiting the seller&apos;s response.
        </p>
      )}

      {offer.status === 'COUNTERED' && (
        <p className="text-sm font-medium">
          Seller countered at <strong>{fmt(offer.current_amount)}</strong>. Accept, decline, or counter?
        </p>
      )}

      {offer.status === 'ACCEPTED' && (
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
          Your offer was accepted! Complete your purchase before the deadline.
        </p>
      )}

      {offer.status === 'DECLINED' && (
        <p className="text-sm text-muted-foreground">
          Your offer was declined.
        </p>
      )}

      {offer.status === 'EXPIRED' && (
        <p className="text-sm text-muted-foreground">
          Your offer expired with no response.
        </p>
      )}

      {offer.status === 'WITHDRAWN' && (
        <p className="text-sm text-muted-foreground">
          You withdrew this offer.
        </p>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
          <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        {offer.status === 'ACCEPTED' && (
          <Button size="sm" className="flex-1" asChild>
            <Link href={peerListingCheckoutHref(listingSection, listingSlug, offer.id)}>
              Checkout — {fmt(offer.current_amount)}
            </Link>
          </Button>
        )}

        {offer.status === 'COUNTERED' && (
          <>
            <Button
              size="sm"
              className="flex-1"
              onClick={() => onRespond('ACCEPT')}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
              Accept {fmt(offer.current_amount)}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onSetCounterOpen(!counterOpen)}
              disabled={loading || offer.counter_count >= 3}
            >
              {counterOpen ? <ChevronUp className="h-3.5 w-3.5 mr-1" /> : <ChevronDown className="h-3.5 w-3.5 mr-1" />}
              Counter
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onRespond('DECLINE')}
              disabled={loading}
            >
              Decline
            </Button>
          </>
        )}

        {offer.status === 'PENDING' && (
          <Button
            size="sm"
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={() => onRespond('WITHDRAW')}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
            Withdraw offer
          </Button>
        )}

        {['DECLINED', 'EXPIRED', 'WITHDRAWN'].includes(offer.status) && (
          <Button size="sm" variant="outline" className="flex-1" onClick={onMakeNew}>
            <Tag className="h-3.5 w-3.5 mr-1" />
            Make a new offer
          </Button>
        )}
      </div>

      {/* Inline counter form */}
      {counterOpen && offer.status === 'COUNTERED' && (
        <>
          <Separator />
          <div className="space-y-3">
            <p className="text-sm font-medium">Your counter offer</p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">$</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min={minOffer}
                max={askingPrice}
                value={counterAmount}
                onChange={(e) => onSetCounterAmount(e.target.value)}
                placeholder="Enter amount"
                className="w-full rounded-md border border-input bg-background pl-7 pr-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <Textarea
              placeholder="Add a note (optional)"
              value={counterNote}
              onChange={(e) => onSetCounterNote(e.target.value.slice(0, 200))}
              rows={2}
              className="resize-none text-sm"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1"
                disabled={loading || !counterAmount}
                onClick={() => {
                  const amt = parseFloat(counterAmount)
                  if (!isNaN(amt)) {
                    onRespond('COUNTER', { amount: amt, note: counterNote.trim() || undefined })
                  }
                }}
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                Send counter
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onSetCounterOpen(false)}>
                Cancel
              </Button>
            </div>
            {offer.counter_count >= 2 && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                This is your last counter-offer. After this the negotiation closes.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
