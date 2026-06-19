"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"

export type StoreOffer = {
  offerId: string
  status: string
  buyerName: string
  listingTitle: string
  listingCoverUrl: string | null
  listPrice: number
  currentAmount: number
  floorPrice: number | null
  counterCount: number
}

interface StoreOfferCardProps {
  storeId: string
  offer: StoreOffer
  canRespond: boolean
}

export function StoreOfferCard({ storeId, offer, canRespond }: StoreOfferCardProps) {
  const router = useRouter()
  const [mode, setMode] = useState<"idle" | "counter">("idle")
  const [counter, setCounter] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function respond(action: "accept" | "decline" | "counter") {
    setError(null)
    const payload: Record<string, unknown> = { offerId: offer.offerId, action }
    if (action === "counter") {
      const amt = Number.parseFloat(counter)
      if (!Number.isFinite(amt) || amt <= 0) {
        setError("Enter a valid counter amount.")
        return
      }
      payload.counterAmount = amt
    }
    try {
      const res = await fetch("/api/consignment/store/offers/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, offer: payload }),
      })
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) throw new Error(data?.error ?? "Could not respond to offer")
      startTransition(() => router.refresh())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not respond to offer")
    }
  }

  const pending = offer.status === "PENDING"

  return (
    <li className="px-4 py-4">
      <div className="flex items-center gap-3">
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
          {offer.listingCoverUrl ? (
            <Image
              src={offer.listingCoverUrl}
              alt={offer.listingTitle}
              fill
              sizes="48px"
              className="object-cover"
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{offer.listingTitle}</p>
          <p className="truncate text-xs text-muted-foreground">
            {offer.buyerName} · offered{" "}
            <span className="font-semibold text-foreground">${offer.currentAmount.toFixed(2)}</span>{" "}
            of ${offer.listPrice.toFixed(2)}
            {offer.floorPrice != null ? ` · floor $${offer.floorPrice.toFixed(2)}` : ""}
          </p>
        </div>
        {!pending ? (
          <span className="shrink-0 rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
            Awaiting buyer
          </span>
        ) : null}
      </div>

      {canRespond && pending ? (
        <div className="mt-3">
          {mode === "idle" ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => respond("accept")}
                disabled={isPending}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                Accept ${offer.currentAmount.toFixed(2)}
              </button>
              <button
                type="button"
                onClick={() => setMode("counter")}
                disabled={isPending}
                className="rounded-md border px-3 py-1.5 text-xs font-medium"
              >
                Counter
              </button>
              <button
                type="button"
                onClick={() => respond("decline")}
                disabled={isPending}
                className="rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-destructive"
              >
                Decline
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">$</span>
              <input
                type="number"
                min={offer.floorPrice ?? 0}
                step={1}
                value={counter}
                onChange={(e) => setCounter(e.target.value)}
                placeholder="Counter amount"
                className="h-9 w-32 rounded-md border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={() => respond("counter")}
                disabled={isPending}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                Send counter
              </button>
              <button
                type="button"
                onClick={() => setMode("idle")}
                disabled={isPending}
                className="rounded-md border px-3 py-1.5 text-xs font-medium"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      ) : null}

      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </li>
  )
}
