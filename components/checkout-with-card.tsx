"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { CreditCard, Loader2, AlertCircle } from "lucide-react"
import Link from "next/link"

interface CheckoutWithCardProps {
  listingId: string
  listingTitle: string
  price: number
  fulfillment?: "pickup" | "shipping" | null
}

export function CheckoutWithCard({
  listingId,
  listingTitle,
  price,
  fulfillment,
}: CheckoutWithCardProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleCheckout = async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/checkout/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listing_id: listingId,
          ...(fulfillment ? { fulfillment } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Checkout failed")
        return
      }
      if (data.url) {
        window.location.href = data.url
        return
      }
      setError("No checkout URL returned")
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        size="lg"
        className="w-full gap-2"
        onClick={handleCheckout}
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Redirecting…
          </>
        ) : (
          <>
            <CreditCard className="h-4 w-4" />
            Pay with card or Apple Pay — ${price.toFixed(2)}
          </>
        )}
      </Button>
      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error === "Card payments are not configured" ? (
            <span>Card payments are not available right now.</span>
          ) : error === "Unauthorized" ? (
            <span>
              <Link href="/auth/login" className="underline">Sign in</Link> to checkout with card.
            </span>
          ) : (
            error
          )}
        </div>
      )}
    </div>
  )
}
