"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Truck, CheckCircle2, Package, Loader2, AlertCircle, RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  deliveryStatusLabel,
  deliveryStatusBadgeVariant,
  payoutStatusLabel,
  payoutStatusBadgeVariant,
} from "@/lib/order-status"

type PayoutInfo = { status: string; hold_reason?: string | null }

// ── Seller: add tracking ──────────────────────────────────────

export function SellerTrackingForm({
  orderId,
  deliveryStatus,
}: {
  orderId: string
  deliveryStatus: string
}) {
  const router = useRouter()
  const [trackingNumber, setTrackingNumber] = useState("")
  const [carrier, setCarrier] = useState("")
  const [busy, setBusy] = useState(false)

  if (deliveryStatus !== "pending") return null

  const submit = async () => {
    if (!trackingNumber.trim()) {
      toast.error("Enter a tracking number")
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`/api/orders/${orderId}/tracking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tracking_number: trackingNumber.trim(),
          tracking_carrier: carrier.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Could not add tracking")
        return
      }
      toast.success("Tracking added — buyer notified")
      router.refresh()
    } catch {
      toast.error("Something went wrong")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="border-primary/20 bg-primary/[0.02]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Truck className="h-4 w-4 text-primary" />
          </div>
          Add tracking
        </CardTitle>
        <CardDescription className="text-xs">
          Ship the item and add the tracking number. Your payout is held until delivery is confirmed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-2">
        <Input
          placeholder="Tracking number"
          value={trackingNumber}
          onChange={(e) => setTrackingNumber(e.target.value)}
        />
        <Input
          placeholder="Carrier (USPS, UPS, FedEx…)"
          value={carrier}
          onChange={(e) => setCarrier(e.target.value)}
        />
        <Button onClick={submit} disabled={busy} className="w-full gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
          Submit tracking
        </Button>
      </CardContent>
    </Card>
  )
}

// ── Seller: verify pickup code ────────────────────────────────

export function SellerPickupVerify({
  orderId,
  deliveryStatus,
}: {
  orderId: string
  deliveryStatus: string
}) {
  const router = useRouter()
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (deliveryStatus === "picked_up") return null

  const submit = async () => {
    if (!code.trim()) {
      toast.error("Enter the 6-digit code from the buyer")
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/orders/${orderId}/verify-pickup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Verification failed")
        return
      }
      toast.success("Pickup confirmed — payout released")
      router.refresh()
    } catch {
      toast.error("Something went wrong")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="border-primary/20 bg-primary/[0.02]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Package className="h-4 w-4 text-primary" />
          </div>
          Verify pickup
        </CardTitle>
        <CardDescription className="text-xs">
          Ask the buyer for their 6-digit pickup code. Entering it releases your payout.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-2">
        <Input
          placeholder="6-digit pickup code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={6}
          inputMode="numeric"
          className="text-center text-lg font-mono tracking-widest"
        />
        {error && (
          <p className="text-sm text-destructive flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </p>
        )}
        <Button onClick={submit} disabled={busy} className="w-full gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Verify code
        </Button>
      </CardContent>
    </Card>
  )
}

// ── Buyer: confirm delivery ───────────────────────────────────

export function BuyerConfirmDelivery({
  orderId,
  deliveryStatus,
}: {
  orderId: string
  deliveryStatus: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  if (deliveryStatus !== "shipped") return null

  const confirm = async () => {
    setBusy(true)
    try {
      const res = await fetch(`/api/orders/${orderId}/confirm-delivery`, {
        method: "POST",
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Could not confirm delivery")
        return
      }
      toast.success("Delivery confirmed — seller payout released")
      router.refresh()
    } catch {
      toast.error("Something went wrong")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="border-green-500/30 bg-green-50/50 dark:bg-green-950/20">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          Confirm delivery
        </CardTitle>
        <CardDescription>
          Received your item? Confirming delivery releases the seller&apos;s payout.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={confirm} disabled={busy} className="w-full">
          {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          I received my item
        </Button>
      </CardContent>
    </Card>
  )
}

// ── Shared: delivery + payout status badges ───────────────────

export function DeliveryStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={deliveryStatusBadgeVariant(status)} className="gap-1">
      {status === "shipped" && <Truck className="h-3.5 w-3.5" />}
      {(status === "delivered" || status === "picked_up") && <CheckCircle2 className="h-3.5 w-3.5" />}
      {deliveryStatusLabel(status)}
    </Badge>
  )
}

export function PayoutStatusBadge({ payout }: { payout: PayoutInfo | null }) {
  if (!payout) return null
  return (
    <Badge variant={payoutStatusBadgeVariant(payout.status)} className="gap-1">
      {payoutStatusLabel(payout.status, payout.hold_reason)}
    </Badge>
  )
}

// ── Buyer: pickup code display ────────────────────────────────

export function BuyerPickupCode({
  pickupCode,
  deliveryStatus,
}: {
  pickupCode: string
  deliveryStatus: string
}) {
  if (deliveryStatus === "picked_up") return null

  return (
    <Card className="border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20">
      <CardHeader>
        <CardTitle className="text-lg">Your pickup code</CardTitle>
        <CardDescription>
          Show this code to the seller when you pick up the item. It confirms the handoff and
          releases their payout.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-mono font-bold tracking-[0.3em] text-center py-2">
          {pickupCode}
        </p>
      </CardContent>
    </Card>
  )
}

// ── Seller: request support (refund / cancel / return) ───────
// Sellers cannot issue refunds directly. This sends a request to
// the admin team via order_support_requests.

export function SellerRequestSupportButton({
  orderId,
  orderStatus,
}: {
  orderId: string
  orderStatus: string
}) {
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const [requestType, setRequestType] = useState<"refund_request" | "cancel_request" | "return_request">("refund_request")
  const [body, setBody] = useState("")

  if (orderStatus === "refunded") return null

  const typeLabels: Record<typeof requestType, string> = {
    refund_request: "Request refund",
    cancel_request: "Request cancellation",
    return_request: "Request return",
  }

  const submit = async () => {
    if (body.trim().length < 10) {
      toast.error("Please add a bit more detail (at least 10 characters).")
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/seller-support`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_type: requestType, body: body.trim() }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        toast.error(data.error ?? "Could not send request")
        return
      }
      toast.success("Request sent — our team will review it and follow up.")
      setOpen(false)
      setBody("")
    } catch {
      toast.error("Something went wrong")
    } finally {
      setBusy(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="w-full gap-2 text-muted-foreground">
          <RotateCcw className="h-4 w-4" />
          Request refund, cancel, or return
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Submit a request to Reswell support</AlertDialogTitle>
          <AlertDialogDescription>
            Select what you need and provide details. Our team will review and action it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex flex-wrap gap-2">
            {(["refund_request", "cancel_request", "return_request"] as const).map((t) => (
              <Button
                key={t}
                size="sm"
                variant={requestType === t ? "default" : "outline"}
                onClick={() => setRequestType(t)}
              >
                {typeLabels[t]}
              </Button>
            ))}
          </div>
          <textarea
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[100px]"
            placeholder="Tell us what happened and why you're requesting this…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <Button onClick={submit} disabled={busy || body.trim().length < 10}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Submit request
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ── Seller: refunded order banner ─────────────────────────────

export function SellerRefundedBanner({
  amount,
  refundedAt,
}: {
  amount: number
  refundedAt: string | null
}) {
  const dateStr = refundedAt
    ? new Date(refundedAt).toLocaleDateString(undefined, { dateStyle: "medium" })
    : null

  return (
    <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 flex items-start gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10 shrink-0">
        <RotateCcw className="h-4 w-4 text-destructive" />
      </div>
      <div>
        <p className="text-sm font-semibold text-destructive">Order refunded</p>
        <p className="text-sm text-muted-foreground mt-0.5">
          The buyer receives a full refund of ${amount.toFixed(2)}
          {dateStr ? ` on ${dateStr}` : ""} — the entire amount they paid. Your net earnings after fees
          are reversed from your account.
        </p>
      </div>
    </div>
  )
}

// ── Tracking display ──────────────────────────────────────────

export function TrackingInfo({
  trackingNumber,
  trackingCarrier,
}: {
  trackingNumber: string
  trackingCarrier?: string | null
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted shrink-0">
          <Truck className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-sm font-medium">Tracking added</p>
          <p className="text-sm text-muted-foreground truncate">
            {trackingCarrier && <span>{trackingCarrier} · </span>}
            <span className="font-mono">{trackingNumber}</span>
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
