import Image from "next/image"
import Link from "next/link"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import type { ModelPricingSale } from "@/lib/pricing/model-pricing"
import { cn } from "@/lib/utils"

const cardClassName =
  "rounded-2xl border border-[#e6eaf2] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:border-border dark:bg-card"

const rowGridClassName = "grid grid-cols-[minmax(0,1.4fr)_8.5rem_10rem_9.5rem] items-center"

export function ModelPricingSales({ sales }: { sales: ModelPricingSale[] }) {
  return (
    <section className={cn(cardClassName, "mt-4 overflow-hidden")}>
      <div className="overflow-x-auto">
        <div className="min-w-[40rem]">
          <div
            className={cn(
              rowGridClassName,
              "px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#1a2744] dark:text-foreground",
            )}
          >
            <div>Recent sales</div>
            <div>Price</div>
            <div>Condition</div>
            <div>Date</div>
          </div>
          {sales.length === 0 ? (
            <p className="border-t border-[#eef1f6] px-6 py-8 text-sm text-[#6b7689] dark:border-border dark:text-muted-foreground">
              No completed sales yet.
            </p>
          ) : (
            <ul>
              {sales.map((sale) => (
                <li key={sale.id} className="border-t border-[#eef1f6] dark:border-border">
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
        <div className="relative h-14 w-14 overflow-hidden rounded-md bg-[#eef0f4] dark:bg-muted">
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
      <div className="py-3.5 text-[15px] tabular-nums text-[#1c2740] dark:text-foreground">{sale.priceLabel}</div>
      <div className="py-3.5 text-[15px] text-[#1c2740] dark:text-foreground">{sale.conditionLabel}</div>
      <div className="py-3.5 text-[15px] text-[#1c2740] dark:text-foreground">{sale.dateLabel}</div>
    </>
  )
  const className = cn(rowGridClassName, "px-6 hover:bg-[#f8f9fc] dark:hover:bg-white/5")
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
