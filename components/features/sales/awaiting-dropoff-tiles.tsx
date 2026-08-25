import Image from "next/image"
import Link from "next/link"
import { Package, Truck } from "lucide-react"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import { cn } from "@/lib/utils"

export type AwaitingDropoffSale = {
  orderId: string
  orderNum: string
  title: string
  imageUrl: string | null
}

export function AwaitingDropoffTiles({ sales }: { sales: AwaitingDropoffSale[] }) {
  if (sales.length === 0) return null

  return (
    <section className="space-y-2">
      <div>
        <p className="text-sm font-semibold text-foreground">Ready to drop off</p>
        <p className="text-xs text-muted-foreground">
          Labels are ready. These leave this list when the carrier scans the package.
        </p>
      </div>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {sales.map((sale) => (
          <li key={sale.orderId}>
            <Link
              href={`/dashboard/sales/${sale.orderId}`}
              className={cn(
                "block overflow-hidden rounded-xl border border-amber-500/30 bg-amber-500/[0.04]",
                "transition-colors hover:border-amber-500/50 hover:bg-amber-500/[0.07]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              )}
            >
              <div className="relative aspect-[4/3] bg-muted">
                {sale.imageUrl ? (
                  <Image
                    src={sale.imageUrl}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="(min-width: 1024px) 180px, (min-width: 640px) 30vw, 45vw"
                    unoptimized={listingImageShouldBypassOptimization(sale.imageUrl)}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Package className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="space-y-1 p-2.5">
                <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-foreground">
                  {sale.title}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">Sale #{sale.orderNum}</p>
                <p className="flex items-center gap-1 text-[11px] font-medium text-amber-950 dark:text-amber-100">
                  <Truck className="h-3 w-3 shrink-0" />
                  Waiting for scan
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
