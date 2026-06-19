"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

interface StoreRepriceRowProps {
  listingId: string
  price: number
  floorPrice: number | null
  canReprice: boolean
}

export function StoreRepriceRow({ listingId, price, floorPrice, canReprice }: StoreRepriceRowProps) {
  const router = useRouter()
  const [value, setValue] = useState(price.toString())
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  const dirty = Number.parseFloat(value) !== price

  if (!canReprice) {
    return (
      <div className="text-right">
        <p className="text-sm font-semibold tabular-nums">${price.toFixed(2)}</p>
        {floorPrice != null ? (
          <p className="text-[11px] text-muted-foreground">Floor ${floorPrice.toFixed(2)}</p>
        ) : null}
      </div>
    )
  }

  async function save() {
    setError(null)
    setSaved(false)
    const next = Number.parseFloat(value)
    if (!Number.isFinite(next) || next <= 0) {
      setError("Enter a valid price")
      return
    }
    try {
      const res = await fetch(`/api/consignment/listings/${listingId}/reprice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price: next }),
      })
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) throw new Error(data?.error ?? "Could not update price")
      setSaved(true)
      startTransition(() => router.refresh())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update price")
    }
  }

  return (
    <div className="text-right">
      <div className="flex items-center justify-end gap-1.5">
        <span className="text-sm text-muted-foreground">$</span>
        <input
          type="number"
          min={floorPrice ?? 0}
          step={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-9 w-24 rounded-md border bg-background px-2 text-right text-sm tabular-nums outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="button"
          onClick={save}
          disabled={isPending || !dirty}
          className="h-9 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-40"
        >
          {isPending ? "…" : "Save"}
        </button>
      </div>
      {floorPrice != null ? (
        <p className="mt-1 text-[11px] text-muted-foreground">Floor ${floorPrice.toFixed(2)}</p>
      ) : null}
      {saved && !dirty ? <p className="mt-1 text-[11px] text-muted-foreground">Saved</p> : null}
      {error ? <p className="mt-1 text-[11px] text-destructive">{error}</p> : null}
    </div>
  )
}
