"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { CreditCard, Wallet, Loader2, AlertCircle, ArrowLeft } from "lucide-react"
import { BuyWithBucks } from "@/components/buy-with-bucks"

interface UsedCheckoutFormProps {
  listingId: string
  listingTitle: string
  price: number
  sellerId: string
}

export function UsedCheckoutForm({
  listingId,
  listingTitle,
  price,
  sellerId,
}: UsedCheckoutFormProps) {
  const [cardLoading, setCardLoading] = useState(false)
  const [applePayLoading, setApplePayLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleCardOrApplePay() {
    setError("")
    setCardLoading(true)
    try {
      const res = await fetch("/api/checkout/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing_id: listingId }),
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
      setCardLoading(false)
    }
  }

  const loading = cardLoading || applePayLoading

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Order summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{listingTitle}</span>
            <span>${price.toFixed(2)}</span>
          </div>
          <Separator />
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span className="text-primary">${price.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <p className="text-sm font-medium text-muted-foreground">Choose payment method</p>
        <div className="grid gap-3">
          <Button
            variant="outline"
            size="lg"
            className="w-full gap-2"
            onClick={handleCardOrApplePay}
            disabled={loading}
          >
            {cardLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Redirecting…
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4" />
                Pay with card
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="w-full gap-2"
            onClick={handleCardOrApplePay}
            disabled={loading}
          >
            {applePayLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Redirecting…
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4" />
                Pay with Apple Pay
              </>
            )}
          </Button>
          <div className="relative">
            <Separator className="absolute inset-0 flex items-center" />
            <span className="relative flex justify-center text-xs uppercase text-muted-foreground bg-background px-2">
              or
            </span>
          </div>
          <BuyWithBucks
            listingId={listingId}
            listingTitle={listingTitle}
            price={price}
            sellerId={sellerId}
          />
        </div>
      </div>

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
