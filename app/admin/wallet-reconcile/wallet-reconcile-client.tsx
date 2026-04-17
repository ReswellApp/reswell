"use client"

import { useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Wallet } from "lucide-react"
import { toast } from "sonner"

export function WalletReconcileClient() {
  const [paymentIntentId, setPaymentIntentId] = useState("")
  const [orderId, setOrderId] = useState("")
  const [loading, setLoading] = useState(false)
  const [lastResult, setLastResult] = useState<{
    orderId: string
    fullyRefunded: boolean
    paymentIntentId: string
  } | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)

  const runSync = async () => {
    setLoading(true)
    setLastError(null)
    setLastResult(null)
    try {
      const res = await fetch("/api/admin/wallet-reconcile-stripe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentIntentId: paymentIntentId.trim() || undefined,
          orderId: orderId.trim() || undefined,
        }),
      })
      const data = (await res.json()) as {
        error?: string
        ok?: boolean
        orderId?: string
        fullyRefunded?: boolean
        paymentIntentId?: string
      }

      if (!res.ok) {
        const msg = typeof data.error === "string" ? data.error : "Request failed"
        setLastError(msg)
        toast.error(msg)
        return
      }

      if (data.ok && data.orderId && data.paymentIntentId) {
        setLastResult({
          orderId: data.orderId,
          fullyRefunded: Boolean(data.fullyRefunded),
          paymentIntentId: data.paymentIntentId,
        })
        toast.success("Wallet sync completed")
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Network error"
      setLastError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Stripe wallet sync</h1>
        <p className="text-muted-foreground mt-1">
          Reconcile a card order with Stripe: update order and payout rows from current refund totals,
          and add any missing seller wallet clawback transactions. Safe to run more than once.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wallet className="h-5 w-5" />
            Run sync
          </CardTitle>
          <CardDescription>
            Paste a Stripe PaymentIntent id (<span className="font-mono text-xs">pi_…</span>) from the
            Stripe Dashboard, or an internal order id from Admin → Orders (Stripe card checkouts only).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pi">PaymentIntent id</Label>
            <Input
              id="pi"
              placeholder="pi_xxxxxxxxxxxxxxxxxxxxxxxx"
              value={paymentIntentId}
              onChange={(e) => setPaymentIntentId(e.target.value)}
              autoComplete="off"
              disabled={loading}
            />
          </div>
          <p className="text-xs text-muted-foreground text-center">or</p>
          <div className="space-y-2">
            <Label htmlFor="oid">Order id (UUID)</Label>
            <Input
              id="oid"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              autoComplete="off"
              disabled={loading}
            />
          </div>

          <Button className="w-full sm:w-auto" onClick={() => void runSync()} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Syncing…
              </>
            ) : (
              "Sync wallet from Stripe"
            )}
          </Button>

          {lastError && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{lastError}</AlertDescription>
            </Alert>
          )}

          {lastResult && (
            <Alert>
              <AlertTitle>Success</AlertTitle>
              <AlertDescription className="space-y-1 text-sm">
                <p>
                  Order <span className="font-mono">{lastResult.orderId}</span> updated.
                </p>
                <p>
                  PaymentIntent <span className="font-mono break-all">{lastResult.paymentIntentId}</span>
                </p>
                <p>
                  Fully refunded in Stripe:{" "}
                  <span className="font-medium">{lastResult.fullyRefunded ? "yes" : "no"}</span>
                </p>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
