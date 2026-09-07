"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Truck, CheckCircle2, Package, Loader2, AlertCircle, LifeBuoy, RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { helpHubHref } from "@/lib/help/help-hub-intents"
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
      toast.success("Tracking saved — the buyer can track this shipment on their purchase.")
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
          Save your carrier tracking here — both you and the buyer can reference it on your order pages. The buyer is
          notified when tracking is saved. Payout stays on hold until they confirm delivery and a Reswell admin
          approves your payout.
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
          Received your item? Confirm so we know it was delivered. Seller payout timing follows Reswell
          carrier tracking when available — this button is for orders without live Reswell tracking.
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
// Sellers cannot issue refunds or cancel orders directly — Help Hub opens a case.

export function SellerRequestSupportButton({
  orderId,
  orderStatus,
}: {
  orderId: string
  orderStatus: string
}) {
  if (orderStatus === "refunded" || orderStatus === "refunding") return null

  return (
    <Button variant="outline" className="w-full gap-2 text-muted-foreground" asChild>
      <Link
        href={helpHubHref({
          intent: "order",
          orderId,
          role: "seller",
        })}
      >
        <LifeBuoy className="h-4 w-4" />
        Get help with this sale
      </Link>
    </Button>
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
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
