import Image from "next/image"
import Link from "next/link"
import { ChevronLeft, ChevronRight, MapPin, Package, Truck } from "lucide-react"
import { CopyOrderNumber } from "@/components/features/purchases/copy-order-number"
import {
  purchaseAccentTextClassName,
  purchaseTrackRowClassName,
} from "@/components/features/purchases/purchase-brand-styles"
import { LocalDateOnly } from "@/components/ui/local-datetime"
import { listingPhotoFillClassName } from "@/lib/listing-photo-fill"
import type { PurchaseStatusTone } from "@/lib/purchases-list-display"
import { formatUsd } from "@/lib/utils/format-usd"
import { cn } from "@/lib/utils"

const STATUS_BANNER: Record<PurchaseStatusTone, string> = {
  success: "bg-green-50 text-green-900 dark:bg-green-950/40 dark:text-green-100",
  warning: "bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100",
  danger: "bg-rose-50 text-rose-900 dark:bg-rose-950/40 dark:text-rose-100",
  neutral: "bg-slate-50 text-slate-800 dark:bg-slate-900/50 dark:text-slate-100",
}

export interface SaleDetailSummaryItem {
  id: string
  title: string
  buyerName: string
  detailLine: string
  imageUrl: string | null
  imageUnoptimized: boolean
  href: string
  price: number | null
}

export interface SaleDetailSummaryProps {
  items: SaleDetailSummaryItem[]
  orderNumber: string
  itemAmount: number
  shippingAmount: number
  showShipping: boolean
  platformFee: number
  showPayouts: boolean
  earningsAmount: number
  saleTotal: number
  amountStruck: boolean
  refundNote: string | null
  promoNote: string | null
  shippingNote: string | null
  paymentLabel: string
  statusLabel: string
  statusTone: PurchaseStatusTone
  statusDateIso: string | null
  addressName: string | null
  addressLines: string[]
  trackUrl: string | null
}

export function SaleDetailSummary(props: SaleDetailSummaryProps) {
  const totalLabel = props.showPayouts ? "Your earnings" : "Sale total"
  const totalAmount = props.showPayouts ? props.earningsAmount : props.saleTotal

  return (
    <>
      <Link
        href="/dashboard/sales"
        className={cn(
          "inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700",
          purchaseAccentTextClassName,
        )}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Back to List
      </Link>

      <h1 className="font-headline text-2xl font-bold tracking-tight text-foreground">Sale Details</h1>

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
              <p className="text-sm text-muted-foreground">to {item.buyerName}</p>
              {item.detailLine ? <p className="text-sm text-muted-foreground">{item.detailLine}</p> : null}
              {item.price != null ? (
                <p className="text-sm font-bold text-foreground">{formatUsd(item.price)}</p>
              ) : null}
            </div>
          </div>
        ))}
      </div>

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
            <dt className="text-muted-foreground">Item price</dt>
            <dd className="font-medium tabular-nums text-foreground">{formatUsd(props.itemAmount)}</dd>
          </div>
          {props.showShipping ? (
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="text-muted-foreground">Shipping</dt>
              <dd className="font-medium tabular-nums text-foreground">{formatUsd(props.shippingAmount)}</dd>
            </div>
          ) : null}
          {props.showPayouts && props.platformFee > 0 ? (
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="text-muted-foreground">Platform fee</dt>
              <dd className="font-medium tabular-nums text-foreground">-{formatUsd(props.platformFee)}</dd>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-muted-foreground">Payment</dt>
            <dd className="font-medium text-foreground">{props.paymentLabel}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="font-bold text-foreground">{totalLabel}</dt>
            <dd
              className={cn(
                "font-bold tabular-nums",
                purchaseAccentTextClassName,
                props.amountStruck && "line-through decoration-slate-400",
              )}
            >
              {formatUsd(totalAmount)}
            </dd>
          </div>
        </dl>
        {props.promoNote ? (
          <p className="pb-2 text-xs leading-relaxed text-muted-foreground">{props.promoNote}</p>
        ) : null}
        {props.shippingNote ? (
          <p className="pb-2 text-xs leading-relaxed text-muted-foreground">{props.shippingNote}</p>
        ) : null}
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
    </>
  )
}
