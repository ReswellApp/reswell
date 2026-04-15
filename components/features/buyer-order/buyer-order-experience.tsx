"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  ExternalLink,
  HelpCircle,
  Loader2,
  MessageCircle,
  Package,
  RotateCcw,
  ScrollText,
  Shield,
  Truck,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"
import { carrierTrackingUrl } from "@/lib/utils/carrier-tracking-url"
import { deliveryStatusLabel } from "@/lib/order-status"
import { Button } from "@/components/ui/button"
import { LocalDateTime } from "@/components/ui/local-datetime"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"

export type BuyerOrderExperienceProps = {
  orderId: string
  displayOrderNum: string
  createdAtIso: string
  amount: number
  status: string
  fulfillmentMethod: string | null
  deliveryStatus: string
  trackingNumber: string | null
  trackingCarrier: string | null
  paidWithCard: boolean
  paymentMethod: string | null
  refundedAt: string | null
  listingTitle: string
  sellerName: string
  messagesHref: string
  canRequestCancel: boolean
  canRequestRefundHelp: boolean
}

type JourneyStep = {
  key: string
  title: string
  description: string
  state: "done" | "current" | "upcoming"
}

function buildJourney(props: BuyerOrderExperienceProps): JourneyStep[] {
  const { fulfillmentMethod, deliveryStatus, trackingNumber, status, paymentMethod, refundedAt, amount } = props
  const ship = fulfillmentMethod === "shipping"

  if (status === "refunded") {
    const refundDateStr = refundedAt
      ? new Date(refundedAt).toLocaleDateString(undefined, { dateStyle: "medium" })
      : null
    const isCard = paymentMethod === "stripe"
    const fundsDesc = isCard
      ? "Your card refund has been submitted to Stripe. It typically takes 5-10 business days to appear on your statement."
      : `$${amount.toFixed(2)} in Reswell Bucks has been credited back to your wallet balance.`

    return [
      {
        key: "placed",
        title: "Order placed",
        description: "Your original purchase was confirmed.",
        state: "done",
      },
      {
        key: "refund-issued",
        title: `Refund issued${refundDateStr ? ` — ${refundDateStr}` : ""}`,
        description: `A full refund of $${amount.toFixed(2)} was processed for this order.`,
        state: "done",
      },
      {
        key: "funds-returned",
        title: isCard ? "Card refund in progress" : "Reswell Bucks returned",
        description: fundsDesc,
        state: isCard ? "current" : "done",
      },
    ]
  }

  if (ship) {
    const hasTrack = !!trackingNumber?.trim()
    const shipped = deliveryStatus === "shipped" || deliveryStatus === "delivered"
    const delivered = deliveryStatus === "delivered"

    return [
      {
        key: "placed",
        title: "Order placed",
        description: "We’ve notified the seller. They’ll pack and ship your item.",
        state: "done",
      },
      {
        key: "ship",
        title: hasTrack || shipped ? "Shipped" : "Seller ships your board",
        description: hasTrack
          ? "Tracking is available — use Track package below."
          : "You’ll see tracking here once the seller adds it.",
        state: !hasTrack && !shipped ? "current" : "done",
      },
      {
        key: "transit",
        title: "In transit",
        description: "Watch tracking for delivery updates.",
        state: shipped && !delivered ? "current" : shipped ? "done" : "upcoming",
      },
      {
        key: "confirm",
        title: "Confirm delivery",
        description: "When your board arrives, confirm delivery to complete the order.",
        state: delivered ? "done" : shipped ? "current" : "upcoming",
      },
    ]
  }

  const donePickup = deliveryStatus === "picked_up"

  return [
    {
      key: "placed",
      title: "Order placed",
      description: "Message the seller to agree on a safe public meeting place and time.",
      state: "done",
    },
    {
      key: "meet",
      title: "Meet & inspect",
      description:
        "Bring your pickup code when you meet. Inspect the board before you leave — the seller confirms your code to complete the sale.",
      state: donePickup ? "done" : "current",
    },
  ]
}

export function BuyerOrderExperience(props: BuyerOrderExperienceProps) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [refundOpen, setRefundOpen] = useState(false)

  const [helpBody, setHelpBody] = useState("")
  const [cancelBody, setCancelBody] = useState("")
  const [refundBody, setRefundBody] = useState("")
  const [contactedSeller, setContactedSeller] = useState<string>("")
  const [submitting, setSubmitting] = useState(false)

  const trackUrl = useMemo(() => {
    if (!props.trackingNumber?.trim()) return null
    return carrierTrackingUrl(props.trackingNumber.trim(), props.trackingCarrier)
  }, [props.trackingNumber, props.trackingCarrier])

  const journey = useMemo(() => buildJourney(props), [props])

  const submit = async (
    request_type: "help" | "cancel_order" | "refund_help",
    body: string,
    contacted?: boolean,
  ) => {
    setSubmitting(true)
    try {
      const payload: Record<string, unknown> = { request_type, body: body.trim() }
      if (request_type === "refund_help" && typeof contacted === "boolean") {
        payload.contacted_seller_first = contacted
      }
      const res = await fetch(`/api/orders/${encodeURIComponent(props.orderId)}/buyer-support`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        toast.error(data.error ?? "Could not send request")
        return
      }
      toast.success("Request sent — our team will email you if we need more detail.")
      setHelpOpen(false)
      setCancelOpen(false)
      setRefundOpen(false)
      setHelpBody("")
      setCancelBody("")
      setRefundBody("")
      setContactedSeller("")
    } catch {
      toast.error("Something went wrong")
    } finally {
      setSubmitting(false)
    }
  }

  const isRefunded = props.status === "refunded"

  return (
    <div className="space-y-8">
      <Card className={`overflow-hidden shadow-sm ${
        isRefunded
          ? "border-destructive/20 bg-gradient-to-b from-destructive/[0.04] to-background"
          : "border-primary/15 bg-gradient-to-b from-primary/[0.06] to-background"
      }`}>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className={`text-[11px] font-semibold uppercase tracking-wider ${
                isRefunded ? "text-destructive/80" : "text-primary/80"
              }`}>
                {isRefunded ? "Refund processed" : "What happens next"}
              </p>
              <CardTitle className="mt-1 text-xl font-semibold tracking-tight">
                {isRefunded
                  ? `$${props.amount.toFixed(2)} refund issued`
                  : "Your purchase is protected on Reswell"}
              </CardTitle>
              <CardDescription className="text-[15px] leading-relaxed mt-2 max-w-2xl">
                {isRefunded
                  ? "This order has been fully refunded. See the timeline below for details on when to expect your funds."
                  : "Follow the steps below. Message your seller anytime, track shipment when available, and reach our team if something doesn\u2019t look right."}
              </CardDescription>
            </div>
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
              isRefunded ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
            }`}>
              {isRefunded ? <RotateCcw className="h-5 w-5" aria-hidden /> : <Shield className="h-5 w-5" aria-hidden />}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-0 pt-2">
          {journey.map((step, i) => (
            <div key={step.key}>
              {i > 0 ? <Separator className="my-4 bg-border/60" /> : null}
              <div className="flex gap-4">
                <div className="flex flex-col items-center pt-0.5">
                  {step.state === "done" ? (
                    <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" aria-hidden />
                  ) : step.state === "current" ? (
                    <Circle className="h-6 w-6 text-primary fill-primary/15 shrink-0" aria-hidden />
                  ) : (
                    <Circle className="h-6 w-6 text-muted-foreground/40 shrink-0" aria-hidden />
                  )}
                </div>
                <div className="min-w-0 flex-1 pb-1">
                  <p className="font-semibold text-foreground leading-snug">{step.title}</p>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{step.description}</p>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {!isRefunded && trackUrl ? (
          <Button className="gap-2" asChild>
            <a href={trackUrl} target="_blank" rel="noopener noreferrer">
              <Truck className="h-4 w-4" />
              Track package
              <ExternalLink className="h-3.5 w-3.5 opacity-70" />
            </a>
          </Button>
        ) : !isRefunded && props.fulfillmentMethod === "shipping" ? (
          <Button type="button" variant="secondary" disabled className="gap-2">
            <Truck className="h-4 w-4" />
            Tracking when seller ships
          </Button>
        ) : null}

        <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
          <SheetTrigger asChild>
            <Button type="button" variant="outline" className="gap-2">
              <ScrollText className="h-4 w-4" />
              Order details
            </Button>
          </SheetTrigger>
          <SheetContent className="w-full sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Order details</SheetTitle>
              <SheetDescription>Reference and payment summary for this purchase.</SheetDescription>
            </SheetHeader>
            <div className="mt-6 space-y-4 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Order</span>
                <span className="font-mono font-medium text-right">#{props.displayOrderNum}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Placed</span>
                <span className="text-right">
                  <LocalDateTime iso={props.createdAtIso} dateStyle="long" timeStyle="short" />
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Item</span>
                <span className="text-right font-medium line-clamp-2">{props.listingTitle}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Seller</span>
                <span className="text-right">{props.sellerName}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Fulfillment</span>
                <span className="text-right">
                  {props.fulfillmentMethod === "shipping" ? "Shipping" : "Local pickup"}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Delivery status</span>
                <span className="text-right">{deliveryStatusLabel(props.deliveryStatus)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Payment</span>
                <span className="text-right">{props.paidWithCard ? "Card (Stripe)" : "Reswell Bucks"}</span>
              </div>
              <Separator />
              <div className="flex justify-between gap-4 text-base font-semibold">
                <span>Total paid</span>
                <span className="tabular-nums">${props.amount.toFixed(2)}</span>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        <Button type="button" variant="outline" className="gap-2" asChild>
          <Link href={props.messagesHref}>
            <MessageCircle className="h-4 w-4" />
            Message seller
          </Link>
        </Button>

        {props.status === "confirmed" ? (
          <>
            <Button
              type="button"
              variant="outline"
              className="gap-2 border-amber-500/30 text-amber-950 dark:text-amber-100"
              onClick={() => setHelpOpen(true)}
            >
              <HelpCircle className="h-4 w-4" />
              Ask Reswell
            </Button>

            {props.canRequestCancel && (
              <Button type="button" variant="outline" className="gap-2" onClick={() => setCancelOpen(true)}>
                <XCircle className="h-4 w-4" />
                Request cancellation
              </Button>
            )}

            {props.canRequestRefundHelp && (
              <Button type="button" variant="outline" className="gap-2" onClick={() => setRefundOpen(true)}>
                <Package className="h-4 w-4" />
                Refund help
              </Button>
            )}
          </>
        ) : null}
      </div>

      {isRefunded ? (
        <p className="text-xs text-muted-foreground flex flex-wrap items-start gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
          <span>
            This order has been fully refunded. If you have any questions about the refund timeline or
            amount, contact our support team.
          </span>
        </p>
      ) : (
        <p className="text-xs text-muted-foreground flex flex-wrap items-start gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
          <span>
            Refunds on card payments are processed by our team after review — we may ask you to work with the
            seller first. Never mark delivery complete until you&apos;ve received and inspected your item.
          </span>
        </p>
      )}

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Ask Reswell a question</DialogTitle>
            <DialogDescription>
              Describe what you need. This goes to our support team (not the seller). We typically reply within
              1–2 business days.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="help-body">Your message</Label>
            <Textarea
              id="help-body"
              value={helpBody}
              onChange={(e) => setHelpBody(e.target.value)}
              rows={5}
              placeholder="e.g. I need to change my shipping address before it ships…"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={() => setHelpOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={submitting || helpBody.trim().length < 10}
              onClick={() => void submit("help", helpBody)}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Request order cancellation</DialogTitle>
            <DialogDescription>
              Use this before the seller ships (or before pickup is completed). We&apos;ll review and contact
              you — cancellation isn&apos;t guaranteed until confirmed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="cancel-body">Why do you need to cancel?</Label>
            <Textarea
              id="cancel-body"
              value={cancelBody}
              onChange={(e) => setCancelBody(e.target.value)}
              rows={5}
              placeholder="Briefly explain your situation…"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={() => setCancelOpen(false)}>
              Back
            </Button>
            <Button
              type="button"
              disabled={submitting || cancelBody.trim().length < 10}
              onClick={() => void submit("cancel_order", cancelBody)}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Refund help</DialogTitle>
            <DialogDescription>
              Tell us what went wrong. For many issues, messaging the seller is the fastest path — we ask so we
              can route your case correctly.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Have you already messaged the seller about this?</Label>
              <RadioGroup value={contactedSeller} onValueChange={setContactedSeller} className="flex gap-6">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="refund-yes" />
                  <Label htmlFor="refund-yes" className="font-normal">
                    Yes
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="refund-no" />
                  <Label htmlFor="refund-no" className="font-normal">
                    No
                  </Label>
                </div>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label htmlFor="refund-body">What should we know?</Label>
              <Textarea
                id="refund-body"
                value={refundBody}
                onChange={(e) => setRefundBody(e.target.value)}
                rows={5}
                placeholder="Describe the issue, what you expected, and what happened…"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={() => setRefundOpen(false)}>
              Back
            </Button>
            <Button
              type="button"
              disabled={
                submitting ||
                refundBody.trim().length < 10 ||
                (contactedSeller !== "yes" && contactedSeller !== "no")
              }
              onClick={() =>
                void submit(
                  "refund_help",
                  refundBody,
                  contactedSeller === "yes" ? true : contactedSeller === "no" ? false : undefined,
                )
              }
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit to support"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
