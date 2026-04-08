"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle2, Loader2 } from "lucide-react"

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
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const paymentIntent = searchParams.get("payment_intent")
  const redirectStatus = searchParams.get("redirect_status")
  const orderIdInUrl = searchParams.get("order_id")?.trim() ?? null

  const [finalizeError, setFinalizeError] = useState<string | null>(null)
  const [finalizedOrderId, setFinalizedOrderId] = useState<string | null>(null)
  const [finalizeAuth, setFinalizeAuth] = useState(false)
  const [finalizeBusy, setFinalizeBusy] = useState(false)

  const signInContinueHref = `/auth/login?redirect=${encodeURIComponent(`${pathname}?${searchParams.toString()}`)}`

  useEffect(() => {
    if (!orderIdInUrl || paymentIntent) return
    router.replace(`/successpage/${orderIdInUrl}`)
  }, [orderIdInUrl, paymentIntent, router])

  useEffect(() => {
    if (!paymentIntent) return
    if (redirectStatus === "failed") {
      setFinalizeError("Your bank did not authorize this payment.")
      return
    }

    let cancelled = false
    setFinalizeBusy(true)
    setFinalizeError(null)
    setFinalizeAuth(false)

    ;(async () => {
      try {
        const res = await fetch("/api/stripe/finalize-order", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payment_intent_id: paymentIntent }),
        })
        const data = (await res.json()) as { error?: string; orderId?: string }
        if (cancelled) return
        if (res.status === 401) {
          setFinalizeAuth(true)
          return
        }
        if (!res.ok) {
          setFinalizeError(data.error ?? "Could not complete your order.")
          return
        }
        if (!data.orderId?.trim()) {
          setFinalizeError("Could not complete your order.")
          return
        }
        setFinalizedOrderId(data.orderId.trim())
      } catch {
        if (!cancelled) setFinalizeError("Something went wrong completing your order.")
      } finally {
        if (!cancelled) setFinalizeBusy(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [paymentIntent, redirectStatus])

  useEffect(() => {
    if (!finalizedOrderId) return
    router.replace(`/successpage/${finalizedOrderId}`)
  }, [finalizedOrderId, router])

  if (!paymentIntent && !orderIdInUrl) {
    return <StaticSuccess />
  }

  if (paymentIntent && redirectStatus === "failed") {
    return (
      <main className="flex-1 py-16">
        <div className="container mx-auto max-w-md text-center">
          <Card>
            <CardContent className="pt-8 pb-8 space-y-4">
              <h1 className="text-xl font-bold">Payment issue</h1>
              <p className="text-sm text-muted-foreground">
                Your bank did not authorize this payment.
              </p>
              <div className="flex flex-col gap-3">
                <Button asChild>
                  <Link href="/dashboard/orders">View orders</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/boards">Browse boards</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    )
  }

  if (finalizeAuth) {
    return (
      <main className="flex-1 py-16">
        <div className="container mx-auto max-w-md text-center">
          <Card>
            <CardContent className="pt-8 pb-8 space-y-4">
              <div className="flex justify-center mb-2">
                <div className="rounded-full bg-green-100 p-4 dark:bg-green-900/40">
                  <CheckCircle2 className="h-12 w-12 text-green-700 dark:text-green-300" />
                </div>
              </div>
              <h1 className="text-xl font-bold">Payment received</h1>
              <p className="text-sm text-muted-foreground">
                Your card was charged successfully. Sign in with the same account you used at checkout to load
                your order confirmation.
              </p>
              <div className="flex flex-col gap-3">
                <Button asChild>
                  <Link href={signInContinueHref}>Sign in to continue</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/dashboard/orders">View orders</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    )
  }

  if (finalizeError) {
    return (
      <main className="flex-1 py-16">
        <div className="container mx-auto max-w-md text-center">
          <Card>
            <CardContent className="pt-8 pb-8 space-y-4">
              <h1 className="text-xl font-bold">Something went wrong</h1>
              <p className="text-sm text-muted-foreground">{finalizeError}</p>
              <div className="flex flex-col gap-3">
                <Button asChild>
                  <Link href="/dashboard/orders">View orders</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/boards">Browse boards</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    )
  }

  const waitingOnFinalize =
    Boolean(paymentIntent) && redirectStatus !== "failed" && !finalizedOrderId && !finalizeError && !finalizeAuth

  const redirectingToSuccess =
    Boolean(orderIdInUrl) && !paymentIntent && !finalizeError && !finalizeAuth

  const goingToReceipt =
    Boolean(finalizedOrderId) && !finalizeError && !finalizeAuth

  if (finalizeBusy || waitingOnFinalize || redirectingToSuccess || goingToReceipt) {
    return (
      <main className="flex-1 py-16">
        <div className="container mx-auto max-w-md flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {finalizeBusy || waitingOnFinalize
              ? "Confirming your order…"
              : "Taking you to your receipt…"}
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="flex-1 py-16">
      <div className="container mx-auto max-w-md text-center">
        <Button asChild>
          <Link href="/dashboard/orders">View orders</Link>
        </Button>
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
