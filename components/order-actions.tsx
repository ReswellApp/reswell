"use client"

import { useEffect, useState } from "react"
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
  existingTrackingNumber,
  existingTrackingCarrier,
}: {
  orderId: string
  deliveryStatus: string
  existingTrackingNumber?: string | null
  existingTrackingCarrier?: string | null
}) {
  const router = useRouter()
  const [trackingNumber, setTrackingNumber] = useState(existingTrackingNumber?.trim() ?? "")
  const [carrier, setCarrier] = useState(existingTrackingCarrier?.trim() ?? "")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setTrackingNumber(existingTrackingNumber?.trim() ?? "")
    setCarrier(existingTrackingCarrier?.trim() ?? "")
  }, [existingTrackingNumber, existingTrackingCarrier])

  if (deliveryStatus !== "pending") return null
  if (existingTrackingNumber?.trim()) return null

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
      toast.success(
        "Tracking saved. The buyer can see it on their purchase. Confirm shipment when you drop the package off.",
      )
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
          Save your carrier tracking here — both you and the buyer can reference it on your order pages. When you drop
          the package off, confirm shipment below; the buyer gets one message with tracking then. Payout stays on hold
          until they confirm delivery and a Reswell admin approves your payout.
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
          Save tracking
        </Button>
      </CardContent>
    </Card>
  )
}

/** After Reswell or you added tracking while the order is still “pending”, confirm you handed the package to the carrier. */
export function SellerConfirmShipmentButton({
  orderId,
  deliveryStatus,
  trackingNumber,
}: {
  orderId: string
  deliveryStatus: string
  trackingNumber: string | null
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  if (deliveryStatus !== "pending" || !trackingNumber?.trim()) return null

  const submit = async () => {
    setBusy(true)
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/confirm-shipment`, {
        method: "POST",
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        toast.error(data.error ?? "Could not update order")
        return
      }
      toast.success("Marked as shipped — buyer can track delivery.")
      router.refresh()
    } catch {
      toast.error("Something went wrong")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="border-blue-200/80 bg-blue-50/80 dark:border-blue-900/50 dark:bg-blue-950/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Truck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          Ready to ship?
        </CardTitle>
        <CardDescription className="text-xs">
          Tracking is on this sale. When you’ve handed the package to the carrier, confirm so the buyer sees it as
          shipped and delivery protection can start.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={submit} disabled={busy} className="w-full gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          I’ve shipped this order
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
          Received your item? Confirm so we know it was delivered. A Reswell admin still must approve payout to the
          seller after review — confirming here does not release funds by itself.
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

/** Footer blue (`listingHeart`) at low opacity — shared wherever the pickup code banner appears. */
export const pickupCodeBannerSurfaceClassName =
  "border-listingHeart/30 bg-listingHeart/[0.08] dark:bg-listingHeart/15"

export const pickupCodeBannerLabelClassName = "text-listingHeart dark:text-listingHeart/90"

export function BuyerPickupCode({
  pickupCode,
  deliveryStatus,
}: {
  pickupCode: string
  deliveryStatus: string
}) {
  if (deliveryStatus === "picked_up") return null

  return (
    <Card className={pickupCodeBannerSurfaceClassName}>
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

// ── Seller: request support (refund or cancel via Reswell) ──
// Sellers cannot issue refunds or cancel orders directly. This sends a request to
// the admin team via order_support_requests. Returns are buyer-only.

export function SellerRequestSupportButton({
  orderId,
  orderStatus,
}: {
  orderId: string
  orderStatus: string
}) {
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const [requestType, setRequestType] = useState<"refund_request" | "cancel_request">("refund_request")
  const [body, setBody] = useState("")

  if (orderStatus === "refunded" || orderStatus === "refunding") return null

  const typeLabels: Record<typeof requestType, string> = {
    refund_request: "Ask Reswell to issue a refund",
    cancel_request: "Ask Reswell to cancel the order",
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
          Ask Reswell for a refund or cancellation
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Submit a request to Reswell support</AlertDialogTitle>
          <AlertDialogDescription>
            You can’t issue a refund or cancel the order yourself — tell us what you need and we’ll
            review it. Returns are handled on the buyer side.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex flex-wrap gap-2">
            {(["refund_request", "cancel_request"] as const).map((t) => (
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

/** Stripe (or admin) has started a refund; settlement may still be pending. */
export function SellerRefundInProgressBanner({
  amount,
  paidWithCard,
}: {
  amount: number
  paidWithCard: boolean
}) {
  return (
    <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-4 flex items-start gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 shrink-0">
        <RotateCcw className="h-4 w-4 text-amber-800 dark:text-amber-200" />
      </div>
      <div>
        <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">Refund in progress</p>
        <p className="text-sm text-muted-foreground mt-0.5">
          A refund of ${amount.toFixed(2)} is processing
          {paidWithCard ? " to the buyer’s card through Stripe" : ""}. This sale will show as fully
          refunded when it completes.{" "}
          {paidWithCard
            ? "Bank timelines vary; the buyer may not see the credit for several business days."
            : "You’ll get a confirmation here when it finishes."}
        </p>
      </div>
    </div>
  )
}

// ── Tracking display ──────────────────────────────────────────

export function TrackingInfo({
  trackingNumber,
  trackingCarrier,
  variant = "buyer",
  deliveryStatus,
}: {
  trackingNumber: string
  trackingCarrier?: string | null
  variant?: "buyer" | "seller"
  deliveryStatus?: string
}) {
  const isSeller = variant === "seller"
  const buyerNotified = !isSeller || deliveryStatus !== "pending"

  return (
    <Card
      className={
        isSeller
          ? "border-blue-200/80 bg-blue-50/80 dark:border-blue-900/50 dark:bg-blue-950/20"
          : undefined
      }
    >
      <CardContent className="flex items-start gap-4 p-5">
        <div
          className={
            isSeller
              ? "flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/15 shrink-0"
              : "flex h-10 w-10 items-center justify-center rounded-lg bg-muted shrink-0"
          }
        >
          {isSeller ? (
            <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          ) : (
            <Truck className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium">
            {isSeller ? "Tracking saved" : "Tracking added"}
          </p>
          <p className="text-sm text-muted-foreground truncate">
            {trackingCarrier && <span>{trackingCarrier} · </span>}
            <span className="font-mono">{trackingNumber}</span>
          </p>
          {isSeller && buyerNotified ? (
            <p className="text-xs text-muted-foreground leading-relaxed pt-0.5">
              The buyer can see this on their purchase page and in Messages. They also receive an email
              with the tracking number.
            </p>
          ) : isSeller ? (
            <p className="text-xs text-muted-foreground leading-relaxed pt-0.5">
              The buyer can already see this on their purchase page. Confirm shipment below when you’ve
              handed the package to the carrier — they’ll get one message with tracking then.
            </p>
          ) : !isSeller && deliveryStatus === "pending" ? (
            <p className="text-xs text-muted-foreground leading-relaxed pt-0.5">
              The seller saved this tracking for your order. You’ll get a message when they confirm the
              package was handed to the carrier.
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
