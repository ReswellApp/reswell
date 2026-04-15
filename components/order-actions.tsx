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
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Add tracking
        </CardTitle>
        <CardDescription>
          Ship the item, then add the tracking number. Your payout is held until the buyer confirms
          delivery.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
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
        <Button onClick={submit} disabled={busy} className="w-full">
          {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
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
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Package className="h-5 w-5" />
          Verify pickup
        </CardTitle>
        <CardDescription>
          Ask the buyer for their 6-digit pickup code. Entering it releases your payout.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input
          placeholder="6-digit pickup code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={6}
          inputMode="numeric"
        />
        {error && (
          <p className="text-sm text-destructive flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5" />
            {error}
          </p>
        )}
        <Button onClick={submit} disabled={busy} className="w-full">
          {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
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

// ── Seller: issue refund ──────────────────────────────────────

export function SellerRefundButton({
  orderId,
  orderStatus,
  amount,
  paymentMethod,
}: {
  orderId: string
  orderStatus: string
  amount: number
  paymentMethod: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)

  if (orderStatus !== "confirmed") return null

  const isCard = paymentMethod === "stripe"
  const refundTarget = isCard ? "their card" : "their Reswell Bucks balance"

  const submit = async () => {
    setBusy(true)
    try {
      const res = await fetch(`/api/orders/${orderId}/refund`, { method: "POST" })
      const data = (await res.json()) as { error?: string; refund_type?: string }
      if (!res.ok) {
        toast.error(data.error ?? "Could not issue refund")
        return
      }
      if (data.refund_type === "stripe") {
        toast.success("Refund issued — the buyer's card will be refunded by Stripe shortly.")
      } else {
        toast.success("Refund complete — Reswell Bucks returned to the buyer.")
      }
      setOpen(false)
      router.refresh()
    } catch {
      toast.error("Something went wrong")
    } finally {
      setBusy(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" className="w-full gap-2">
          <RotateCcw className="h-4 w-4" />
          Issue refund
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Refund ${amount.toFixed(2)} to the buyer?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block">
              This will refund <strong>${amount.toFixed(2)}</strong> to {refundTarget} and
              debit your seller earnings. The listing will be re-activated for sale.
            </span>
            <span className="block font-medium text-destructive">
              This action cannot be undone.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <Button variant="destructive" onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Confirm refund
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
    <Card className="border-destructive/30 bg-destructive/5">
      <CardContent className="flex items-start gap-3 p-4">
        <RotateCcw className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-destructive">Order refunded</p>
          <p className="text-sm text-muted-foreground mt-1">
            ${amount.toFixed(2)} was refunded to the buyer
            {dateStr ? ` on ${dateStr}` : ""}.
            Your seller earnings for this order have been reversed.
          </p>
        </div>
      </CardContent>
    </Card>
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
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Tracking
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        {trackingCarrier && (
          <p className="text-muted-foreground">
            Carrier: <span className="font-medium text-foreground">{trackingCarrier}</span>
          </p>
        )}
        <p className="text-muted-foreground">
          Tracking #:{" "}
          <span className="font-mono font-medium text-foreground">{trackingNumber}</span>
        </p>
      </CardContent>
    </Card>
  )
}
