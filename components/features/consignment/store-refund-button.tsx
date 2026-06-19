"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

interface StoreRefundButtonProps {
  orderId: string
  amount: number
}

export function StoreRefundButton({ orderId, amount }: StoreRefundButtonProps) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function refund() {
    setError(null)
    try {
      const res = await fetch(`/api/pos/orders/${orderId}/refund`, { method: "POST" })
      const data = (await res.json().catch(() => null)) as
        | { error?: string; data?: { message?: string } }
        | null
      if (!res.ok) {
        throw new Error(data?.error ?? "Refund failed")
      }
      setConfirming(false)
      startTransition(() => router.refresh())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refund failed")
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        Refund
      </button>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Refund ${amount.toFixed(2)}?</span>
        <button
          type="button"
          onClick={refund}
          disabled={isPending}
          className="rounded-md bg-destructive px-2 py-1 text-xs font-medium text-destructive-foreground disabled:opacity-50"
        >
          {isPending ? "…" : "Confirm"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={isPending}
          className="rounded-md border px-2 py-1 text-xs font-medium"
        >
          Cancel
        </button>
      </div>
      {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
    </div>
  )
}
