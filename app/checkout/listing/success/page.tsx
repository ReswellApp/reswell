"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, Loader2, AlertCircle, Package, Truck, MapPin } from "lucide-react"
import { capitalizeWords } from "@/lib/listing-labels"

type VerifySuccessBody = {
  success: true
  duplicate?: boolean
  purchase_id: string
  listing_id: string
  listing_title: string
  amount: number
  fulfillment_method: "pickup" | "shipping" | null
  listing_section: string
  purchased_at: string
}

function formatPurchasedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" })
  } catch {
    return iso
  }
}

function PeerListingCheckoutSuccessInner() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get("session_id")
  const [state, setState] = useState<"loading" | "ok" | "err">("loading")
  const [message, setMessage] = useState("")
  const [details, setDetails] = useState<VerifySuccessBody | null>(null)

  useEffect(() => {
    if (!sessionId) {
      setState("err")
      setMessage("Missing session.")
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/checkout/verify-board-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
        })
        const data = (await res.json()) as VerifySuccessBody | { error?: string }
        if (cancelled) return
        if (!res.ok) {
          setState("err")
          setMessage((data as { error?: string }).error || "Could not confirm payment")
          return
        }
        setDetails(data as VerifySuccessBody)
        setState("ok")
      } catch {
        if (!cancelled) {
          setState("err")
          setMessage("Something went wrong")
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sessionId])

  return (
    <main className="flex-1 py-16">
      <div className="container mx-auto max-w-md">
        <Card>
          <CardContent className="pt-8 pb-8 text-center">
            {state === "loading" && (
              <>
                <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mx-auto mb-4" />
                <h1 className="text-xl font-bold mb-2">Confirming your purchase…</h1>
                <p className="text-muted-foreground text-sm">This only takes a moment.</p>
              </>
            )}
            {state === "ok" && details && (
              <>
                <div className="flex justify-center mb-4">
                  <div className="rounded-full bg-neutral-100 p-4">
                    <CheckCircle2 className="h-12 w-12 text-neutral-900" />
                  </div>
                </div>
                <h1 className="text-2xl font-bold mb-2">You&apos;re all set</h1>
                <p className="text-muted-foreground text-sm mb-4">
                  Thank you — your payment went through. A receipt is saved to your account.
                </p>

                <div className="rounded-lg border bg-muted/30 text-left p-4 space-y-3 text-sm mb-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-semibold text-foreground">
                      Order #{details.purchase_id.slice(0, 8).toUpperCase()}
                    </span>
                    {details.duplicate && (
                      <Badge variant="secondary" className="text-xs">
                        Already confirmed
                      </Badge>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Item</p>
                    <p className="font-medium text-foreground flex items-start gap-2">
                      <Package className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                      {capitalizeWords(details.listing_title)}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Total paid</p>
                      <p className="font-semibold tabular-nums">${Number(details.amount).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Payment</p>
                      <p className="font-medium">Card (Stripe)</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Date</p>
                    <p>{formatPurchasedAt(details.purchased_at)}</p>
                  </div>
                  <div className="flex items-start gap-2 pt-1 border-t border-border/60">
                    {details.fulfillment_method === "shipping" ? (
                      <>
                        <Truck className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                        <p className="text-muted-foreground">
                          <span className="font-medium text-foreground">Shipping:</span> your address
                          and phone were shared with the seller. You can review everything on your order
                          page.
                        </p>
                      </>
                    ) : (
                      <>
                        <MapPin className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                        <p className="text-muted-foreground">
                          <span className="font-medium text-foreground">Local pickup:</span> message the
                          seller to arrange a safe meetup.
                        </p>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <Button asChild>
                    <Link href={`/dashboard/purchases/${details.purchase_id}`}>View order details</Link>
                  </Button>
                  <Button variant="secondary" asChild>
                    <Link href="/dashboard/purchases">Purchase history</Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/messages">Open messages</Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/gear">Browse gear</Link>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-6">
                  Purchase history is also under{" "}
                  <Link href="/dashboard/preferences" className="text-primary underline underline-offset-2">
                    Settings → Purchases
                  </Link>
                  .
                </p>
              </>
            )}
            {state === "err" && (
              <>
                <div className="flex justify-center mb-4">
                  <AlertCircle className="h-12 w-12 text-destructive" />
                </div>
                <h1 className="text-xl font-bold mb-2">Couldn&apos;t confirm</h1>
                <p className="text-muted-foreground mb-6 text-sm">{message}</p>
                <Button variant="outline" asChild>
                  <Link href="/gear">Back to gear</Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

export default function PeerListingCheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="flex flex-1 items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
      }
    >
      <PeerListingCheckoutSuccessInner />
    </Suspense>
  )
}
