import Image from "next/image"
import Link from "next/link"
import { ChevronRight, Package } from "lucide-react"
import {
  purchaseAccentLinkClassName,
  purchaseAccentTextClassName,
} from "@/components/features/purchases/purchase-brand-styles"
import { ReviewBuyerControls } from "@/components/review-buyer-controls"
import { LocalDateOnly } from "@/components/ui/local-datetime"
import { listingPhotoFillClassName } from "@/lib/listing-photo-fill"
import type { PurchaseStatusTone } from "@/lib/purchases-list-display"
import type { SaleListItem } from "@/lib/sales-list-display"
import { formatUsd } from "@/lib/utils/format-usd"
import { cn } from "@/lib/utils"

const STATUS_PILL_CLASS: Record<PurchaseStatusTone, string> = {
  success: "bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
  danger: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-200",
  neutral: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
}

export function SaleOrderRow({
  item,
  imagePriority = false,
}: {
  item: SaleListItem
  imagePriority?: boolean
}) {
  const detailsLabel = `More details for ${item.title}, order ${item.orderNumber}`

  return (
    <li className="border-b border-border/80 py-6 last:border-b-0">
      <div className="flex items-start gap-4 sm:gap-5">
        <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-lg bg-muted shadow-sm sm:h-20 sm:w-20">
          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt=""
              fill
              priority={imagePriority}
              className={listingPhotoFillClassName}
              sizes="80px"
              unoptimized={item.imageUnoptimized}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Package className="h-6 w-6 text-muted-foreground" aria-hidden />
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="contents sm:block sm:min-w-0 sm:flex-1">
            <div className="min-w-0">
              <Link
                href={item.href}
                className="line-clamp-2 text-[17px] font-bold leading-snug text-foreground hover:underline"
              >
                {item.title}
              </Link>
              <p className="mt-0.5 text-sm text-muted-foreground">to {item.buyerName}</p>
              {item.detailLine ? (
                <p className="text-sm text-muted-foreground">{item.detailLine}</p>
              ) : null}
              <p
                className={cn(
                  "mt-1.5 text-[15px] leading-snug",
                  item.amountStruck && "line-through decoration-slate-400",
                )}
              >
                <span className={cn("font-bold", purchaseAccentTextClassName)}>
                  {formatUsd(item.primaryAmount)}
                </span>
                {item.primarySuffix ? (
                  <span className="font-normal text-muted-foreground"> {item.primarySuffix}</span>
                ) : null}
                {item.showShipping ? (
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    + {formatUsd(item.shippingAmount)} shipping
                  </span>
                ) : null}
              </p>
              {item.refundNote ? (
                <p
                  className={cn(
                    "mt-1.5 text-xs font-medium",
                    item.amountStruck
                      ? "text-rose-700 dark:text-rose-300"
                      : "text-amber-800 dark:text-amber-200",
                  )}
                >
                  {item.refundNote}
                </p>
              ) : null}
            </div>
            {item.buyerReview ? (
              <div className="order-last sm:order-none sm:mt-2.5">
                <ReviewBuyerControls
                  orderId={item.id}
                  buyerName={item.buyerName}
                  canReview={item.buyerReview.canReview}
                  existingReview={item.buyerReview.existing}
                  compact
                />
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-col items-start gap-1 sm:w-56 sm:items-end sm:text-right">
            <span
              className={cn(
                "inline-flex max-w-full rounded-full px-3 py-1 text-center text-xs font-semibold leading-snug",
                STATUS_PILL_CLASS[item.statusTone],
              )}
            >
              {item.statusLabel}
            </span>
            <p className="text-sm text-muted-foreground">
              Sold: <LocalDateOnly iso={item.soldAt} dateStyle="medium" />
            </p>
            <p className="text-sm text-muted-foreground">Order: {item.orderNumber}</p>
            <Link
              href={item.href}
              aria-label={detailsLabel}
              className={cn(
                "mt-0.5 inline-flex items-center gap-0.5 text-sm font-medium",
                purchaseAccentLinkClassName,
              )}
            >
              More details
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    </li>
  )
}
