import Link from "next/link"
import { TriangleAlert } from "lucide-react"
import {
  SHIPPING_ADJUSTMENT_LEARN_MORE_HREF,
  coveredShippingAdjustmentMessage,
  type SellerCoveredShippingAdjustment,
} from "@/lib/shipping/adjustment-strike"

interface SellerShippingAdjustmentNoticeProps {
  adjustment: SellerCoveredShippingAdjustment
}

export function SellerShippingAdjustmentNotice({
  adjustment,
}: SellerShippingAdjustmentNoticeProps) {
  return (
    <section className="rounded-xl border border-amber-500/35 bg-amber-500/[0.06] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-800 dark:text-amber-200">
          <TriangleAlert className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">Carrier adjustment on this shipment</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {coveredShippingAdjustmentMessage(adjustment.amountUsd)}
          </p>
          <Link
            href={SHIPPING_ADJUSTMENT_LEARN_MORE_HREF}
            className="mt-3 inline-flex text-sm font-semibold text-foreground underline underline-offset-2"
          >
            Learn more about shipping best practices
          </Link>
        </div>
      </div>
    </section>
  )
}
