"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { setCoastalShipperPriceAction } from "@/lib/actions/coastalShipperActions"
import { SHIPPER_PRICE_MAX_USD, SHIPPER_PRICE_MIN_USD, shipperPriceUsd } from "@/lib/utils/shipperPrice"
import { Button } from "@/components/ui/button"

interface ShipperPricePanelProps {
  shipperId: string
  priceCents: number
  previewing: boolean
}

export function ShipperPricePanel({ shipperId, priceCents, previewing }: ShipperPricePanelProps) {
  const router = useRouter()
  const [dollars, setDollars] = useState(String(shipperPriceUsd(priceCents)))
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const amount = Number(dollars)
  const ready = Number.isInteger(amount) && amount >= SHIPPER_PRICE_MIN_USD && amount <= SHIPPER_PRICE_MAX_USD

  function onSave() {
    if (!ready || previewing) return
    startTransition(async () => {
      const result = await setCoastalShipperPriceAction({ shipperId, priceUsd: amount })
      if (result.error) {
        setError(result.error)
        return
      }
      setError(null)
      router.refresh()
    })
  }

  return (
    <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-headline text-lg font-semibold tracking-tight text-foreground">Price</h2>
          <p className="text-sm text-muted-foreground">
            Buyers pay this when you are matched. You are owed the same amount.
          </p>
        </div>
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            onSave()
          }}
        >
          <label className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              $
            </span>
            <input
              inputMode="numeric"
              value={dollars}
              disabled={previewing || pending}
              onChange={(event) => setDollars(event.target.value.replace(/[^\d]/g, "").slice(0, 3))}
              aria-label="Price in dollars"
              className="h-10 w-28 rounded-md border border-input bg-background pl-7 pr-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <Button type="submit" disabled={pending || previewing || !ready}>
            {pending ? "Saving…" : "Save price"}
          </Button>
        </form>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Whole dollars, ${SHIPPER_PRICE_MIN_USD} to ${SHIPPER_PRICE_MAX_USD}.
      </p>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </section>
  )
}
