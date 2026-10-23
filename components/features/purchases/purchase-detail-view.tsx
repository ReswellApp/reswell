import Image from "next/image"
import Link from "next/link"
import type { ReactNode } from "react"
import {
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Info,
  MapPin,
  MessageCircle,
  Package,
  Star,
  Store,
  Truck,
  UserRound,
} from "lucide-react"
import {
  purchaseAccentTextClassName,
  purchaseAvatarFallbackClassName,
  purchaseTrackRowClassName,
} from "@/components/features/purchases/purchase-brand-styles"
import { CopyOrderNumber } from "@/components/features/purchases/copy-order-number"
import { ReviewSellerControls } from "@/components/review-seller-controls"
import { SellerRatingStarRow } from "@/components/seller-rating-stars"
import { LocalDateOnly, LocalDateTime } from "@/components/ui/local-datetime"
import { listingPhotoFillClassName } from "@/lib/listing-photo-fill"
import type { PurchaseTimelineEvent } from "@/lib/purchase-detail-timeline"
import type { PurchaseStatusTone } from "@/lib/purchases-list-display"
import type { ExistingMarketplaceReview } from "@/lib/types/marketplace-review"
import { formatUsd } from "@/lib/utils/format-usd"
import { SHIPPING_DEADLINE_DAYS } from "@/lib/shipping-deadline"
import { cn } from "@/lib/utils"

export interface PurchaseDetailItem {
  id: string
  title: string
  sellerName: string
  detailLine: string
  imageUrl: string | null
  imageUnoptimized: boolean
  href: string
  price: number | null
}

const STATUS_BANNER: Record<PurchaseStatusTone, string> = {
  success: "bg-green-50 text-green-900 dark:bg-green-950/40 dark:text-green-100",
  warning: "bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100",
  danger: "bg-rose-50 text-rose-900 dark:bg-rose-950/40 dark:text-rose-100",
  neutral: "bg-slate-50 text-slate-800 dark:bg-slate-900/50 dark:text-slate-100",
}

export interface PurchaseDetailViewProps {
  orderId: string
  orderNumber: string
  items: PurchaseDetailItem[]
  itemAmount: number
  shippingAmount: number
  showShipping: boolean
  totalAmount: number
  amountStruck: boolean
  refundNote: string | null
  statusLabel: string
  statusTone: PurchaseStatusTone
  statusDateIso: string | null
  shippingDeadlineIso: string | null
  shippingDaysLeft: number | null
  timeline: PurchaseTimelineEvent[]
  timelineHeading: string
  addressName: string | null
  addressLines: string[]
  trackUrl: string | null
  sellerName: string
  sellerHandle: string | null
  sellerAvatarUrl: string | null
  sellerHref: string
  messagesHref: string
  shopHref: string
  shopLabel: string
  canReview: boolean
  /** Refunded orders never open a review. Hide the prompt instead of implying one is coming. */
  hideReviewPrompt?: boolean
  existingReview: ExistingMarketplaceReview | null
  reviewFromSeller: ExistingMarketplaceReview | null
  helpCenterHref: string
  messageReswellHref: string
}

function ActionLink({
  href,
  icon,
  children,
  external = false,
}: {
  href: string
  icon: ReactNode
  children: ReactNode
  external?: boolean
}) {
  const className = "flex items-center gap-3 py-2.5 text-sm font-medium text-foreground"
  const body = (
    <>
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
        aria-hidden
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
    </>
  )
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {body}
      </a>
    )
  }
  return (
    <Link href={href} className={className}>
      {body}
    </Link>
  )
}

export function PurchaseDetailView(props: PurchaseDetailViewProps) {
  return (
    <div className="mx-auto w-full max-w-xl space-y-5">
      <Link
        href="/dashboard/purchases"
        className={cn(
          "inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700",
          purchaseAccentTextClassName,
        )}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Back to List
      </Link>

      <h1 className="font-headline text-2xl font-bold tracking-tight text-foreground">Purchase Details</h1>

      <div className="space-y-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-900/40">
        {props.items.map((item, index) => (
          <div key={item.id} className="flex items-start gap-3">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted shadow-sm">
              {item.imageUrl ? (
                <Image
                  src={item.imageUrl}
                  alt=""
                  fill
                  priority={index === 0}
                  className={listingPhotoFillClassName}
                  sizes="64px"
                  unoptimized={item.imageUnoptimized}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Package className="h-5 w-5 text-muted-foreground" aria-hidden />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <Link href={item.href} className="font-bold text-foreground hover:underline">
                {item.title}
              </Link>
              <p className="text-sm text-muted-foreground">by {item.sellerName}</p>
              {item.detailLine ? <p className="text-sm text-muted-foreground">{item.detailLine}</p> : null}
              {item.price != null ? (
                <p className="text-sm font-bold text-foreground">{formatUsd(item.price)}</p>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {props.canReview ? (
        <ReviewSellerControls
          orderId={props.orderId}
          sellerName={props.sellerName}
          canReview
          existingReview={null}
          appearance="row"
        />
      ) : props.existingReview ? (
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-900/40">
          <SellerRatingStarRow value={props.existingReview.rating} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">Your review</p>
            {props.existingReview.comment ? (
              <p className="line-clamp-2 text-xs text-muted-foreground">{props.existingReview.comment}</p>
            ) : null}
          </div>
        </div>
      ) : props.hideReviewPrompt ? null : (
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-muted-foreground dark:bg-slate-900/40">
          <Star className="h-4 w-4 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">Leave a review for the seller</span>
          <span title="You can review the seller after this order is delivered or picked up.">
            <Info
              className={cn("h-4 w-4", purchaseAccentTextClassName)}
              aria-label="You can review the seller after this order is delivered or picked up."
            />
          </span>
        </div>
      )}

      <section className="rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-900/40">
        <h2 className="text-base font-bold text-foreground">Order Details</h2>
        <dl className="mt-2 divide-y divide-border/80 text-sm">
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-muted-foreground">Order number</dt>
            <dd>
              <CopyOrderNumber orderNumber={props.orderNumber} />
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="font-medium tabular-nums text-foreground">{formatUsd(props.itemAmount)}</dd>
          </div>
          {props.showShipping ? (
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="text-muted-foreground">Shipping</dt>
              <dd className="font-medium tabular-nums text-foreground">{formatUsd(props.shippingAmount)}</dd>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="font-bold text-foreground">Total</dt>
            <dd
              className={cn(
                "font-bold tabular-nums",
                purchaseAccentTextClassName,
                props.amountStruck && "line-through decoration-slate-400",
              )}
            >
              {formatUsd(props.totalAmount)}
            </dd>
          </div>
        </dl>
        {props.refundNote ? (
          <p className="pb-2 text-xs font-medium text-rose-700 dark:text-rose-300">{props.refundNote}</p>
        ) : null}
      </section>

      <section className={cn("rounded-xl px-4 py-3", STATUS_BANNER[props.statusTone])}>
        <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">Order status</p>
        <p className="text-lg font-bold leading-tight">{props.statusLabel}</p>
        {props.statusDateIso ? (
          <p className="text-sm">
            <LocalDateOnly iso={props.statusDateIso} dateStyle="long" />
          </p>
        ) : null}
      </section>

      {props.shippingDaysLeft != null && props.shippingDeadlineIso ? (
        <p className="text-sm leading-relaxed text-muted-foreground">
          {props.shippingDaysLeft > 0 ? (
            <>
              Sellers are expected to ship within {SHIPPING_DEADLINE_DAYS} days. If this has not shipped by{" "}
              <LocalDateOnly iso={props.shippingDeadlineIso} dateStyle="medium" /> ({props.shippingDaysLeft}{" "}
              {props.shippingDaysLeft === 1 ? "day" : "days"} left), message the seller or message Reswell.
            </>
          ) : (
            <>
              The {SHIPPING_DEADLINE_DAYS}-day shipping window has passed. Message Reswell if you need help with
              this order.
            </>
          )}
        </p>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-base font-bold text-foreground">{props.timelineHeading}</h2>
        <ol>
          {props.timeline.map((step, index) => {
            const last = index === props.timeline.length - 1
            return (
              <li key={step.id} className="relative flex gap-3 pb-4 last:pb-0">
                {!last ? (
                  <span
                    className={cn(
                      "absolute left-[5px] top-3 h-[calc(100%-4px)] w-px",
                      step.state === "upcoming" ? "bg-border" : "bg-green-600/50",
                    )}
                    aria-hidden
                  />
                ) : null}
                <span
                  className={cn(
                    "relative z-[1] mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
                    step.state === "upcoming" ? "border border-muted-foreground/40 bg-background" : "bg-green-600",
                  )}
                  aria-hidden
                />
                <div className="min-w-0">
                  <p
                    className={cn(
                      "text-sm font-semibold",
                      step.state === "upcoming" ? "text-muted-foreground" : purchaseAccentTextClassName,
                    )}
                  >
                    {step.title}
                  </p>
                  {step.occurredAt ? (
                    <p className="text-xs text-muted-foreground">
                      <LocalDateTime iso={step.occurredAt} dateStyle="medium" timeStyle="short" />
                    </p>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ol>
      </section>

      {props.addressLines.length > 0 ? (
        <section className="flex gap-3 rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-900/40">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
            <MapPin className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 text-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Shipping address
            </p>
            {props.addressName ? <p className="font-bold uppercase text-foreground">{props.addressName}</p> : null}
            {props.addressLines.map((line) => (
              <p key={line} className="text-foreground">
                {line}
              </p>
            ))}
          </div>
        </section>
      ) : null}

      {props.trackUrl ? (
        <a
          href={props.trackUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-foreground",
            purchaseTrackRowClassName,
          )}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
            <Truck className="h-4 w-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">Track your order</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
        </a>
      ) : null}

      <section className="space-y-1 pt-2">
        <h2 className="text-base font-bold text-foreground">Seller</h2>
        <Link href={props.sellerHref} className="flex items-center gap-3 py-2">
          {props.sellerAvatarUrl ? (
            <Image
              src={props.sellerAvatarUrl}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <span
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full",
                purchaseAvatarFallbackClassName,
              )}
            >
              <UserRound className="h-5 w-5" aria-hidden />
            </span>
          )}
          <span className="min-w-0">
            <span className="block font-semibold text-foreground">{props.sellerName}</span>
            {props.sellerHandle ? (
              <span className="block text-sm text-muted-foreground">@{props.sellerHandle}</span>
            ) : null}
          </span>
        </Link>
        <ActionLink href={props.messagesHref} icon={<MessageCircle className="h-3.5 w-3.5" />}>
          Message the seller
        </ActionLink>
        <ActionLink href={props.shopHref} icon={<Store className="h-3.5 w-3.5" />}>
          {props.shopLabel}
        </ActionLink>
        {props.reviewFromSeller ? (
          <p className="pt-1 text-sm text-muted-foreground">
            {props.sellerName} rated you {props.reviewFromSeller.rating}/5
            {props.reviewFromSeller.comment ? ` — ${props.reviewFromSeller.comment}` : "."}
          </p>
        ) : null}
      </section>

      <section className="space-y-1">
        <h2 className="text-base font-bold text-foreground">Need help?</h2>
        <ActionLink href={props.helpCenterHref} icon={<HelpCircle className="h-3.5 w-3.5" />}>
          Help center
        </ActionLink>
        <ActionLink href={props.messageReswellHref} icon={<MessageCircle className="h-3.5 w-3.5" />}>
          Message Reswell
        </ActionLink>
      </section>
    </div>
  )
}
