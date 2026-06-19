"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { MoreVertical } from "lucide-react"

interface StoreListingActionsProps {
  listingId: string
  price: number
}

export function StoreListingActions({ listingId, price }: StoreListingActionsProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<"menu" | "offPlatform" | "withdraw">("menu")
  const [salePrice, setSalePrice] = useState(price.toString())
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function reset() {
    setOpen(false)
    setView("menu")
    setError(null)
  }

  async function post(body: Record<string, unknown>) {
    setError(null)
    try {
      const res = await fetch(`/api/consignment/listings/${listingId}/lifecycle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) throw new Error(data?.error ?? "Action failed")
      reset()
      startTransition(() => router.refresh())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed")
    }
  }

  function recordOffPlatform() {
    const amt = Number.parseFloat(salePrice)
    if (!Number.isFinite(amt) || amt <= 0) {
      setError("Enter a valid sale price.")
      return
    }
    void post({ action: "off_platform_sale", salePrice: amt })
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Board actions"
        onClick={() => (open ? reset() : setOpen(true))}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open ? (
        <div className="absolute right-0 z-10 mt-1 w-64 rounded-lg border bg-popover p-2 shadow-md">
          {view === "menu" ? (
            <div className="flex flex-col">
              <button
                type="button"
                onClick={() => setView("offPlatform")}
                className="rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
              >
                Mark sold (off-platform)
              </button>
              <button
                type="button"
                onClick={() => setView("withdraw")}
                className="rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
              >
                Withdraw / return
              </button>
            </div>
          ) : null}

          {view === "offPlatform" ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Records the sale for your books. No Reswell payout is created — settle the
                consignor&apos;s cut directly.
              </p>
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-muted-foreground">$</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  className="h-9 w-full rounded-md border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={recordOffPlatform}
                  disabled={isPending}
                  className="flex-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
                >
                  Record sale
                </button>
                <button
                  type="button"
                  onClick={() => setView("menu")}
                  className="rounded-md border px-3 py-1.5 text-xs font-medium"
                >
                  Back
                </button>
              </div>
            </div>
          ) : null}

          {view === "withdraw" ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Take this board off sale and return it to the consignor? No money moves.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void post({ action: "withdraw" })}
                  disabled={isPending}
                  className="flex-1 rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground disabled:opacity-50"
                >
                  Withdraw
                </button>
                <button
                  type="button"
                  onClick={() => setView("menu")}
                  className="rounded-md border px-3 py-1.5 text-xs font-medium"
                >
                  Back
                </button>
              </div>
            </div>
          ) : null}

          {error ? <p className="mt-2 px-2 text-xs text-destructive">{error}</p> : null}
        </div>
      ) : null}
    </div>
  )
}
