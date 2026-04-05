"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react"

function CartCheckoutSuccessInner() {
  const searchParams = useSearchParams()
  const orderId = searchParams.get("order_id")
  const sessionId = searchParams.get("session_id")
  const [cleared, setCleared] = useState(false)
  const [confirmState, setConfirmState] = useState<"loading" | "ok" | "err">(() =>
    sessionId ? "loading" : "ok"
  )
  const [confirmMsg, setConfirmMsg] = useState("")

  useEffect(() => {
    if (typeof window !== "undefined" && !cleared) {
      localStorage.removeItem("cart")
      window.dispatchEvent(new CustomEvent("cartUpdated"))
      setCleared(true)
    }
  }, [cleared])

  useEffect(() => {
    if (!sessionId) {
      setConfirmState("ok")
      return
    }

    let cancelled = false
    setConfirmState("loading")
    ;(async () => {
      try {
        const res = await fetch("/api/checkout/verify-cart-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
        })
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setConfirmState("err")
          setConfirmMsg(data.error || "Could not confirm payment")
          return
        }
        setConfirmState("ok")
      } catch {
        if (!cancelled) {
          setConfirmState("err")
          setConfirmMsg("Something went wrong confirming your order")
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sessionId])

  return (
      <main className="flex-1 py-16">
        <div className="container mx-auto max-w-md text-center">
          <Card>
            <CardContent className="pt-8 pb-8">
              {sessionId && confirmState === "loading" && (
                <>
                  <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mx-auto mb-4" />
                  <h1 className="text-xl font-bold mb-2">Confirming your order…</h1>
                  <p className="text-muted-foreground text-sm">This only takes a moment.</p>
                </>
              )}
              {confirmState === "err" && (
                <>
                  <div className="flex justify-center mb-4">
                    <AlertCircle className="h-12 w-12 text-destructive" />
                  </div>
                  <h1 className="text-xl font-bold mb-2">Couldn&apos;t confirm order</h1>
                  <p className="text-muted-foreground mb-6 text-sm">{confirmMsg}</p>
                  <Button variant="outline" asChild>
                    <Link href="/shop">Back to shop</Link>
                  </Button>
                </>
              )}
              {confirmState === "ok" && (
                <>
                  <div className="flex justify-center mb-4">
                    <div className="rounded-full bg-neutral-100 p-4">
                      <CheckCircle2 className="h-12 w-12 text-neutral-900" />
                    </div>
                  </div>
                  <h1 className="text-2xl font-bold mb-2">Order confirmed</h1>
                  <p className="text-muted-foreground mb-6">
                    Thanks for your purchase. Your order has been placed
                    {orderId ? ` (Order #${orderId.slice(0, 8)})` : ""}. Your shipping address and
                    phone from checkout are saved on the order for fulfillment.
                  </p>
                  <div className="flex flex-col gap-3">
                    <Button asChild>
                      <Link href="/dashboard/orders">View my orders</Link>
                    </Button>
                    <Button variant="outline" asChild>
                      <Link href="/shop">Continue shopping</Link>
                    </Button>
                  </div>
                </>
              )}
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
        <main className="flex flex-1 items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
      }
    >
      <CartCheckoutSuccessInner />
    </Suspense>
  )
}
