"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle2, Loader2, ShoppingBag } from "lucide-react"

function StaticSuccess() {
  return (
    <main className="flex-1 py-16">
      <div className="container mx-auto max-w-md text-center">
        <Card>
          <CardContent className="pt-8 pb-8">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-neutral-100 p-4 dark:bg-neutral-800">
                <CheckCircle2 className="h-12 w-12 text-neutral-900 dark:text-neutral-100" />
              </div>
            </div>
            <h1 className="text-xl font-bold mb-2">Thanks for using Reswell</h1>
            <p className="text-muted-foreground text-sm mb-6">
              Your order history lives in your dashboard. You can also pay with Reswell Bucks on future
              purchases.
            </p>
            <div className="flex flex-col gap-3">
              <Button asChild>
                <Link href="/dashboard/orders">View orders</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/gear">Browse gear</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

function CheckoutSuccessInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const paymentIntent = searchParams.get("payment_intent")
  const redirectStatus = searchParams.get("redirect_status")
  const [error, setError] = useState<string | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
    if (!paymentIntent) return

    if (redirectStatus === "failed") {
      setError("Your bank did not authorize this payment.")
      return
    }

    let cancelled = false

    ;(async () => {
      try {
        const res = await fetch("/api/stripe/finalize-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payment_intent_id: paymentIntent }),
        })
        const data = (await res.json()) as { error?: string; orderId?: string }
        if (cancelled) return
        if (!res.ok) {
          setError(data.error ?? "Could not complete your order.")
          return
        }
        setOrderId(data.orderId ?? null)
        setConfirmed(true)
      } catch {
        if (!cancelled) setError("Something went wrong completing your order.")
      }
    })()

    return () => {
      cancelled = true
    }
  }, [paymentIntent, redirectStatus])

  if (!paymentIntent) {
    return <StaticSuccess />
  }

  if (error) {
    return (
      <main className="flex-1 py-16">
        <div className="container mx-auto max-w-md text-center">
          <Card>
            <CardContent className="pt-8 pb-8 space-y-4">
              <h1 className="text-xl font-bold">Payment issue</h1>
              <p className="text-sm text-muted-foreground">{error}</p>
              <div className="flex flex-col gap-3">
                <Button asChild>
                  <Link href="/dashboard/orders">View orders</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/gear">Browse gear</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    )
  }

  if (confirmed) {
    return (
      <main className="flex-1 py-16">
        <div className="container mx-auto max-w-md text-center">
          <Card>
            <CardContent className="pt-8 pb-8">
              <div className="flex justify-center mb-4">
                <div className="rounded-full bg-green-100 p-4 dark:bg-green-900/40">
                  <ShoppingBag className="h-12 w-12 text-green-700 dark:text-green-300" />
                </div>
              </div>
              <h1 className="text-xl font-bold mb-2">Purchase confirmed</h1>
              <p className="text-muted-foreground text-sm mb-6">
                Your payment was successful and the seller has been notified. You can track the
                status of your order from your dashboard.
              </p>
              <div className="flex flex-col gap-3">
                {orderId ? (
                  <Button asChild>
                    <Link href={`/dashboard/orders/${orderId}`}>View your order</Link>
                  </Button>
                ) : (
                  <Button asChild>
                    <Link href="/dashboard/orders">View orders</Link>
                  </Button>
                )}
                <Button variant="outline" asChild>
                  <Link href="/gear">Continue browsing</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    )
  }

  return (
    <main className="flex-1 py-16">
      <div className="container mx-auto max-w-md text-center">
        <Card>
          <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Confirming your order…</p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="flex-1 py-16">
          <div className="container mx-auto max-w-md flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </main>
      }
    >
      <CheckoutSuccessInner />
    </Suspense>
  )
}
