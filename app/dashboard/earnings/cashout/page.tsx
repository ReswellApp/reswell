"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, ShieldCheck, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function CashoutRedirectPage() {
  const router = useRouter()
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [balance, setBalance] = useState<number | null>(null)

  useEffect(() => {
    // Fetch wallet balance to show on the transition screen
    fetch("/api/earnings")
      .then((r) => r.json())
      .then((d) => {
        if (d.wallet?.balance) setBalance(parseFloat(d.wallet.balance))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    // Animate the progress bar over ~1.5 s
    const interval = setInterval(() => {
      setProgress((p) => Math.min(p + 4, 95))
    }, 60)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const fetchAndRedirect = async () => {
      try {
        const res = await fetch("/api/stripe/connect/dashboard-link", { method: "POST" })
        const data = await res.json()

        if (!res.ok || !data.url) {
          setError(data.error ?? "Could not open Stripe dashboard. Please try again.")
          return
        }

        // Small delay so the user sees the transition screen
        setTimeout(() => {
          setProgress(100)
          setTimeout(() => {
            window.location.href = data.url
          }, 200)
        }, 1200)
      } catch {
        setError("Something went wrong. Please try again.")
      }
    }

    fetchAndRedirect()
  }, [])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="w-full max-w-sm text-center space-y-6">

        {error ? (
          <>
            <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <ShieldCheck className="h-8 w-8 text-destructive" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">Couldn&apos;t open Stripe</h2>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <div className="flex flex-col gap-2">
              <Button onClick={() => router.push("/dashboard/earnings")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to earnings
              </Button>
              <Button variant="outline" onClick={() => router.push("/dashboard/payouts")}>
                Set up payouts first
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Taking you to Stripe…</h2>
              <p className="text-sm text-muted-foreground">
                You&apos;re being securely redirected to Stripe to complete your cashout.
              </p>
            </div>

            {balance !== null && (
              <div className="rounded-lg border bg-muted/40 px-4 py-3">
                <p className="text-xs text-muted-foreground mb-0.5">Available to cash out</p>
                <p className="text-2xl font-bold text-primary">${balance.toFixed(2)}</p>
              </div>
            )}

            {/* Progress bar */}
            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-75 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>

            <p className="text-xs text-muted-foreground">
              You&apos;ll be redirected back to Reswell when you&apos;re done.
            </p>

            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => router.push("/dashboard/earnings")}
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
              Cancel
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
