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

      const raw = await res.text()
      let data: {
        error?: string
        code?: string
        url?: string
        stripe_code?: string
      } = {}
      if (raw) {
        try {
          data = JSON.parse(raw) as typeof data
        } catch {
          setError(
            `Server returned an invalid response (${res.status}). If this persists, check deployment logs.`
          )
          return
        }
      }

      if (!res.ok) {
        if (data.code === "stripe_not_configured") {
          setError("stripe_not_configured")
          return
        }
        if (data.code === "stripe_error" && data.error) {
          setError(data.error)
          return
        }
        setError(data.error || `Checkout failed (${res.status})`)
        return
      }
      if (data.url) {
        window.location.href = data.url
        return
      }
      setError("No checkout URL returned")
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error"
      setError(
        msg.includes("Failed to fetch")
          ? "Network error — check your connection or try again."
          : `Something went wrong: ${msg}`
      )
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
            Pay with card — ${price.toFixed(2)}
          </>
        )}
      </Button>
      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error === "stripe_not_configured" ||
          error === "Card payments are not configured" ? (
            <span className="text-left">
              {process.env.NODE_ENV === "development" ? (
                <>
                  Add{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">STRIPE_SECRET_KEY</code>{" "}
                  (test: <code className="text-xs">sk_test_…</code>) to{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">.env.local</code>, restart{" "}
                  <code className="text-xs">next dev</code>, then try again.
                </>
              ) : (
                <span className="block space-y-2">
                  <span className="block font-medium text-foreground">
                    Card checkout isn&apos;t enabled on this server yet.
                  </span>
                  <span className="block text-muted-foreground">
                    <code className="rounded bg-muted px-1 py-0.5 text-xs">.env.local</code> only
                    applies when you run the app locally. For your live site, add{" "}
                    <code className="rounded bg-muted px-1 py-0.5 text-xs">STRIPE_SECRET_KEY</code>{" "}
                    (and redeploy) in your host&apos;s dashboard — e.g. Vercel → Project → Settings →
                    Environment Variables.
                  </span>
                  <span className="block text-muted-foreground">
                    You can still use <strong>Reswell Bucks</strong>, or test card checkout with{" "}
                    <code className="text-xs">npm run dev</code> on your machine.
                  </span>
                </span>
              )}
            </span>
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
