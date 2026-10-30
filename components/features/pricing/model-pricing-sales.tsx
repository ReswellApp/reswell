import Image from "next/image"
import Link from "next/link"
import {
  pricingBodyClassName,
  pricingCardClassName,
  pricingDividerClassName,
  pricingMutedClassName,
  pricingRowHoverClassName,
  pricingThumbClassName,
  pricingTitleClassName,
} from "@/components/features/pricing/pricing-brand-styles"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import type { ModelPricingSale } from "@/lib/pricing/model-pricing"
import { cn } from "@/lib/utils"

const rowGridClassName = "grid grid-cols-[minmax(0,1.4fr)_8.5rem_10rem_9.5rem] items-center"

export function ModelPricingSales({ sales }: { sales: ModelPricingSale[] }) {
  return (
    <section className={cn(pricingCardClassName, "mt-4 overflow-hidden")}>
      <div className="overflow-x-auto">
        <div className="min-w-[40rem]">
          <div
            className={cn(
              rowGridClassName,
              "px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.14em]",
              pricingTitleClassName,
            )}
          >
            <div>Recent sales</div>
            <div>Price</div>
            <div>Condition</div>
            <div>Date</div>
          </div>
          {sales.length === 0 ? (
            <p className={cn("border-t px-6 py-8 text-sm", pricingDividerClassName, pricingMutedClassName)}>
              No completed sales yet.
            </p>
          ) : (
            <ul>
              {sales.map((sale) => (
                <li key={sale.id} className={cn("border-t", pricingDividerClassName)}>
                  <SaleRow sale={sale} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}

function SaleRow({ sale }: { sale: ModelPricingSale }) {
  const body = (
    <>
      <div className="py-3.5">
        <div className={cn("relative h-14 w-14 overflow-hidden rounded-md", pricingThumbClassName)}>
          {sale.imageUrl ? (
            <Image
              src={sale.imageUrl}
              alt=""
              fill
              sizes="56px"
              unoptimized={listingImageShouldBypassOptimization(sale.imageUrl)}
              className="object-cover"
            />
          ) : null}
        </div>
      </div>
      <div className={cn("py-3.5 text-[15px] tabular-nums", pricingBodyClassName)}>{sale.priceLabel}</div>
      <div className={cn("py-3.5 text-[15px]", pricingBodyClassName)}>{sale.conditionLabel}</div>
      <div className={cn("py-3.5 text-[15px]", pricingBodyClassName)}>{sale.dateLabel}</div>
    </>
  )
  const className = cn(rowGridClassName, "px-6", pricingRowHoverClassName)
  if (!sale.href) return <div className={className}>{body}</div>
  if (sale.href.startsWith("/")) {
    return (
      <Link href={sale.href} className={className}>
        {body}
      </Link>
    )
  }
  return (
    <a href={sale.href} className={className} rel="noopener noreferrer">
      {body}
    </a>
  )
}
