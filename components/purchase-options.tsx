"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Loader2, Wallet } from "lucide-react"
import { toast } from "sonner"

interface PurchaseOptionsProps {
  listingId: string
  listingTitle: string
  /** Total charged (item + shipping when applicable). */
  price: number
  /** Surfboards with pickup + shipping: which option the buyer selected. */
  fulfillment?: "pickup" | "shipping" | null
  itemPrice?: number
  shippingAmount?: number
}

export function PurchaseOptions({
  listingId,
  listingTitle,
  price,
  fulfillment,
}: PurchaseOptionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function payWithWallet() {
    setLoading(true)
    try {
      const res = await fetch("/api/wallet/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listing_id: listingId,
          ...(fulfillment ? { fulfillment } : {}),
        }),
      })
      const data = (await res.json()) as {
        error?: string
        balance?: string | number
        purchase?: { id: string }
      }
      if (!res.ok) {
        toast.error(data.error || "Could not complete purchase")
        return
      }
      toast.success(`You bought “${listingTitle}”`)
      const orderId = data.purchase?.id
      if (orderId) {
        router.push(`/dashboard/orders/${orderId}`)
      } else {
        router.push("/dashboard/orders")
      }
    } catch {
      toast.error("Something went wrong. Try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-muted-foreground">Pay with</p>
      <Button
        size="lg"
        className="w-full gap-2"
        onClick={payWithWallet}
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Processing…
          </>
        ) : (
          <>
            <Wallet className="h-4 w-4" />
            Pay with Reswell Bucks — ${price.toFixed(2)}
          </>
        )}
      </Button>
      <p className="text-xs text-muted-foreground">
        Card checkout is paused while we update payments. Add funds under{" "}
        <Link href="/dashboard/wallet" className="text-primary underline underline-offset-2">
          Reswell Bucks
        </Link>{" "}
        if you need a higher balance.
      </p>
    </div>
  )
}
