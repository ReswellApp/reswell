"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ExternalLink,
  HelpCircle,
  MessageCircle,
  Package,
  RotateCcw,
  ScrollText,
  Shield,
  Truck,
} from "lucide-react"
import { carrierTrackingUrl } from "@/lib/utils/carrier-tracking-url"
import { deliveryStatusLabel } from "@/lib/order-status"
import {
  daysUntilShippingDeadline,
  getShippingDeadlineDate,
  isEligibleForShippingDeadlineAutoCancel,
  SHIPPING_DEADLINE_DAYS,
} from "@/lib/shipping-deadline"
import { helpHubHref } from "@/lib/help/help-hub-intents"
import { Button } from "@/components/ui/button"
import { LocalDateTime } from "@/components/ui/local-datetime"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  ReviewSellerControls,
  type ExistingSellerReview,
} from "@/components/review-seller-controls"
import { SellerRatingStarRow } from "@/components/seller-rating-stars"
import { MarketplaceReviewPhotos } from "@/components/features/reviews/marketplace-review-photos"

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
  /** Set when buyer may rate the seller, or when they already left a review for this purchase. */
  sellerReview: {
    canSubmit: boolean
    existing: ExistingSellerReview | null
  }
  /** Seller's rating of you on this order, if they have submitted one (read-only). */
  reviewFromSeller: ExistingSellerReview | null
}

type JourneyStep = {
  key: string
  title: string
  description: string
  state: "done" | "current" | "upcoming"
}

function JourneyStepIndicator({ state }: { state: JourneyStep["state"] }) {
  if (state === "done") {
    return (
      <div
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-listingHeart text-white shadow-sm"
        aria-hidden
      >
        <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
      </div>
    )
  }

  if (state === "current") {
    return (
      <div
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-listingHeart bg-listingHeart/8"
        aria-hidden
      >
        <div className="h-2 w-2 rounded-full bg-listingHeart" />
      </div>
    )
  }

  return (
    <div
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/20 bg-background"
      aria-hidden
    />
  )
}

function buildShippingStepDescription(props: BuyerOrderExperienceProps): string {
  const { createdAtIso, deliveryStatus, trackingNumber } = props
  const hasTrack = !!trackingNumber?.trim()
  const shipped = deliveryStatus === "shipped" || deliveryStatus === "delivered"

  if (hasTrack) {
    return "Tracking is available — use Track package below."
  }

  if (shipped) {
    return "The seller marked your order as shipped."
  }

  const daysLeft = daysUntilShippingDeadline(createdAtIso)
  if (daysLeft <= 0) {
    return "The seller has not shipped yet. Use Get help on this order if you need support."
  }

  const deadlineLabel = getShippingDeadlineDate(createdAtIso).toLocaleDateString(undefined, {
    dateStyle: "medium",
  })

  return `You'll see tracking here once the seller adds it. Sellers typically ship within ${SHIPPING_DEADLINE_DAYS} days (by ${deadlineLabel}).`
}

function buildJourney(props: BuyerOrderExperienceProps): JourneyStep[] {
  const { fulfillmentMethod, deliveryStatus, trackingNumber, status, paymentMethod, refundedAt, amount } = props
  const ship = fulfillmentMethod === "shipping"

  if (status === "refunding") {
    const isCard = paymentMethod === "stripe"
    return [
      {
        key: "placed",
        title: "Purchase confirmed",
        description: "Your original purchase was confirmed.",
        state: "done",
      },
      {
        key: "refund-started",
        title: "Refund in progress",
        description: isCard
          ? `We’re processing a full refund of $${amount.toFixed(2)} to your card through Stripe. This screen will update to “Refunded” when the refund completes.`
          : `We’re processing a full refund of $${amount.toFixed(2)} to your wallet.`,
        state: "current",
      },
      {
        key: "funds-settle",
        title: isCard ? "Refund appears on your statement" : "Wallet updated",
        description: isCard
          ? "Banks often take several business days to show the credit after Stripe marks the refund complete."
          : "Your wallet balance updates as soon as the refund finishes processing.",
        state: "upcoming",
      },
    ]
  }

  if (status === "refunded") {
    const refundDateStr = refundedAt
      ? new Date(refundedAt).toLocaleDateString(undefined, { dateStyle: "medium" })
      : null
    const isCard = paymentMethod === "stripe"
    const fundsDesc = isCard
      ? "Your card refund has been submitted to Stripe. It typically takes 5-10 business days to appear on your statement."
      : `$${amount.toFixed(2)} has been credited back to your wallet.`

    return [
      {
        key: "placed",
        title: "Purchase confirmed",
        description: "Your original purchase was confirmed.",
        state: "done",
      },
      {
        key: "refund-issued",
        title: `Refund issued${refundDateStr ? ` — ${refundDateStr}` : ""}`,
        description: `A full refund of $${amount.toFixed(2)} was processed for this purchase.`,
        state: "done",
      },
      {
        key: "funds-returned",
        title: isCard ? "Card refund in progress" : "Refund to wallet",
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
        title: "Purchase confirmed",
        description: "We’ve notified the seller. They’ll pack and ship your item.",
        state: "done",
      },
      {
        key: "ship",
        title: hasTrack || shipped ? "Shipped" : "Seller ships your order",
        description: buildShippingStepDescription(props),
        state: !hasTrack && !shipped ? "current" : "done",
      },
      {
        key: "transit",
        title: "In transit",
        description: "Watch Reswell tracking for live carrier scans.",
        state: shipped && !delivered ? "current" : shipped ? "done" : "upcoming",
      },
      {
        key: "delivered",
        title: "Delivered",
        description: hasTrack
          ? "When the carrier reports delivery, Reswell completes your order and releases the seller payout after a 24-hour review window."
          : "When your order arrives, confirm delivery to complete it.",
        state: delivered ? "done" : shipped ? "current" : "upcoming",
      },
    ]
  }

  const donePickup = deliveryStatus === "picked_up"

  return [
    {
      key: "placed",
      title: "Purchase confirmed",
      description: "Message the seller to agree on a safe public meeting place and time.",
      state: "done",
    },
    {
      key: "meet",
      title: "Meet & inspect",
      description:
        "Bring your pickup code when you meet. Inspect the item before you leave — the seller confirms your code to complete the sale.",
      state: donePickup ? "done" : "current",
    },
  ]
}

export function BuyerOrderExperience(props: BuyerOrderExperienceProps) {
  const [detailsOpen, setDetailsOpen] = useState(false)

  const trackUrl = useMemo(() => {
    if (!props.trackingNumber?.trim()) return null
    return carrierTrackingUrl(props.trackingNumber.trim(), props.trackingCarrier)
  }, [props.trackingNumber, props.trackingCarrier])

  const journey = useMemo(() => buildJourney(props), [props])

  const getHelpHref = helpHubHref({
    intent: "order",
    orderId: props.orderId,
    role: "buyer",
  })

  const isRefunded = props.status === "refunded"
  const isRefunding = props.status === "refunding"
  const showShippingDeadlineNotice =
    !isRefunded &&
    !isRefunding &&
    isEligibleForShippingDeadlineAutoCancel({
      status: props.status,
      fulfillment_method: props.fulfillmentMethod,
      delivery_status: props.deliveryStatus,
    })
  const shippingDaysLeft = showShippingDeadlineNotice
    ? daysUntilShippingDeadline(props.createdAtIso)
    : null

  return (
    <div className="space-y-8">
      <Card
        className={`overflow-hidden rounded-2xl border shadow-sm ${
          isRefunded
            ? "border-destructive/20 bg-gradient-to-b from-destructive/[0.04] to-background"
            : isRefunding
              ? "border-amber-500/25 bg-gradient-to-b from-amber-500/[0.07] to-background"
              : "border-listingHeart/12 bg-gradient-to-b from-listingHeart/[0.05] to-background"
        }`}
      >
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p
                className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${
                  isRefunded
                    ? "text-destructive/80"
                    : isRefunding
                      ? "text-amber-800 dark:text-amber-200/90"
                      : "text-listingHeart/85"
                }`}
              >
                {isRefunded ? "Refund processed" : isRefunding ? "Refund in progress" : "What happens next"}
              </p>
              <CardTitle className="mt-1.5 text-xl font-semibold tracking-tight">
                {isRefunded
                  ? `$${props.amount.toFixed(2)} refund issued`
                  : isRefunding
                    ? `Refund processing — $${props.amount.toFixed(2)}`
                    : "Your purchase is protected on Reswell"}
              </CardTitle>
              <CardDescription className="mt-2 max-w-2xl text-[15px] leading-relaxed">
                {isRefunded
                  ? "This purchase has been fully refunded. See the timeline below for details on when to expect your funds."
                  : isRefunding
                    ? props.paidWithCard
                      ? "Stripe is returning your payment. This page updates automatically when the refund completes; your bank may take a few days to show the credit."
                      : "Your refund is being finalized. This page updates when it completes."
                    : "Follow the steps below. Message your seller anytime, track shipment when available, and reach our team if something doesn\u2019t look right."}
              </CardDescription>
            </div>
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                isRefunded
                  ? "bg-destructive/10 text-destructive"
                  : isRefunding
                    ? "bg-amber-500/15 text-amber-900 dark:text-amber-100"
                    : "bg-listingHeart/10 text-listingHeart"
              }`}
            >
              {isRefunded || isRefunding ? (
                <RotateCcw className="h-5 w-5" aria-hidden />
              ) : (
                <Shield className="h-5 w-5" aria-hidden />
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <ol className="space-y-0">
            {journey.map((step, i) => {
              const isLast = i === journey.length - 1
              const connectorTone =
                step.state === "done"
                  ? "bg-listingHeart/35"
                  : step.state === "current"
                    ? "bg-listingHeart/20"
                    : "bg-border/70"

              return (
                <li key={step.key} className="relative flex gap-4">
                  <div className="flex flex-col items-center">
                    <JourneyStepIndicator state={step.state} />
                    {!isLast ? (
                      <span
                        className={`mt-2 mb-1 w-px flex-1 min-h-[1.75rem] ${connectorTone}`}
                        aria-hidden
                      />
                    ) : null}
                  </div>
                  <div className={`min-w-0 flex-1 ${isLast ? "pb-0.5" : "pb-6"}`}>
                    <p
                      className={`font-semibold leading-snug ${
                        step.state === "upcoming" ? "text-muted-foreground" : "text-foreground"
                      }`}
                    >
                      {step.title}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
                  </div>
                </li>
              )
            })}
          </ol>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {(props.sellerReview.canSubmit || props.sellerReview.existing) && (
          <ReviewSellerControls
            orderId={props.orderId}
            sellerName={props.sellerName}
            canReview={props.sellerReview.canSubmit}
            existingReview={props.sellerReview.existing}
          />
        )}

        {props.reviewFromSeller ? (
          <Card className="border-muted-foreground/20 bg-muted/25 sm:max-w-md">
            <CardContent className="py-3 px-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Seller feedback
              </p>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span
                  className="inline-flex items-center"
                  role="img"
                  aria-label={`${props.reviewFromSeller.rating} out of 5 stars`}
                >
                  <SellerRatingStarRow value={props.reviewFromSeller.rating} size="md" />
                </span>
                <span className="text-sm font-medium tabular-nums">{props.reviewFromSeller.rating}/5</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  <LocalDateTime
                    iso={props.reviewFromSeller.created_at}
                    dateStyle="medium"
                    timeStyle="short"
                  />
                </span>
              </div>
              {props.reviewFromSeller.comment ? (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {props.reviewFromSeller.comment}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground italic">No written comment.</p>
              )}
              <MarketplaceReviewPhotos
                reviewId={props.reviewFromSeller.id}
                photos={props.reviewFromSeller.photos}
                size="sm"
              />
            </CardContent>
          </Card>
        ) : null}

        {!isRefunded && !isRefunding && trackUrl ? (
          <Button className="gap-2" asChild>
            <a href={trackUrl} target="_blank" rel="noopener noreferrer">
              <Truck className="h-4 w-4" />
              Track package
              <ExternalLink className="h-3.5 w-3.5 opacity-70" />
            </a>
          </Button>
        ) : !isRefunded && !isRefunding && props.fulfillmentMethod === "shipping" ? (
          <Button type="button" variant="secondary" disabled className="gap-2">
            <Truck className="h-4 w-4" />
            Tracking when seller ships
          </Button>
        ) : null}

        <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
          <SheetTrigger asChild>
            <Button type="button" variant="outline" className="gap-2">
              <ScrollText className="h-4 w-4" />
              Purchase details
            </Button>
          </SheetTrigger>
          <SheetContent className="w-full sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Purchase details</SheetTitle>
              <SheetDescription>Reference and payment summary for this purchase.</SheetDescription>
            </SheetHeader>
            <div className="mt-6 space-y-4 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Purchase</span>
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
                <span className="text-right">{props.paidWithCard ? "Card (Stripe)" : "Wallet"}</span>
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
          <Button type="button" variant="outline" className="gap-2" asChild>
            <Link href={getHelpHref}>
              <HelpCircle className="h-4 w-4" />
              Get help
            </Link>
          </Button>
        ) : null}
      </div>

      {isRefunding ? (
        <p className="text-xs text-muted-foreground flex flex-wrap items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2.5">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-700 dark:text-amber-300" />
          <span>
            A refund is underway for this purchase. You don’t need to do anything — refresh this page if the
            status doesn’t update after a few minutes.
          </span>
        </p>
      ) : isRefunded ? (
        <p className="text-xs text-muted-foreground flex flex-wrap items-start gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-listingHeart" />
          <span>
            This purchase has been fully refunded. If you have any questions about the refund timeline or
            amount, contact our support team.
          </span>
        </p>
      ) : showShippingDeadlineNotice ? (
        <p className="text-xs text-muted-foreground flex flex-wrap items-start gap-2 rounded-lg border border-listingHeart/20 bg-listingHeart/[0.05] px-3 py-2.5">
          <Shield className="h-4 w-4 shrink-0 mt-0.5 text-listingHeart" />
          <span>
            {shippingDaysLeft && shippingDaysLeft > 0 ? (
              <>
                Sellers are expected to ship within {SHIPPING_DEADLINE_DAYS} days. If your order isn&apos;t
                shipped by{" "}
                {getShippingDeadlineDate(props.createdAtIso).toLocaleDateString(undefined, {
                  dateStyle: "medium",
                })}{" "}
                ({shippingDaysLeft} day{shippingDaysLeft === 1 ? "" : "s"} left), message the seller or use
                Get help if you need an update.
              </>
            ) : (
              <>
                The {SHIPPING_DEADLINE_DAYS}-day shipping window has passed. Use Get help on this order if
                you need support from Reswell.
              </>
            )}
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

    </div>
  )
}
