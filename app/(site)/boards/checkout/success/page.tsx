"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react"

function BoardCheckoutSuccessInner() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get("session_id")
  const [state, setState] = useState<"loading" | "ok" | "err">("loading")
  const [message, setMessage] = useState("")

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
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setState("err")
          setMessage(data.error || "Could not confirm payment")
          return
        }
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
              {state === "ok" && (
                <>
                  <div className="flex justify-center mb-4">
                    <div className="rounded-full bg-green-100 p-4">
                      <CheckCircle2 className="h-12 w-12 text-green-600" />
                    </div>
                  </div>
                  <h1 className="text-2xl font-bold mb-2">You&apos;re all set</h1>
                  <p className="text-muted-foreground mb-6">
                    Payment received. If you chose delivery, your shipping address and phone were saved
                    for the seller—no need to DM your address. For local pickup, message the seller to
                    arrange a meetup.
                  </p>
                  <div className="flex flex-col gap-3">
                    <Button asChild>
                      <Link href="/messages">Open messages</Link>
                    </Button>
                    <Button variant="outline" asChild>
                      <Link href="/boards">Browse more boards</Link>
                    </Button>
                  </div>
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
                    <Link href="/boards">Back to surfboards</Link>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
  )
}

export default function BoardCheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="flex flex-1 items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
      }
    >
      <BoardCheckoutSuccessInner />
    </Suspense>
  )
}
