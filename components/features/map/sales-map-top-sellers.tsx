import Image from "next/image"
import Link from "next/link"
import { UserRound } from "lucide-react"
import { VerifiedBadge } from "@/components/verified-badge"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import type { MarketplaceSalesMapTopSeller } from "@/lib/types/marketplace-sales-map"

function salesLabel(count: number): string {
  return count === 1 ? "1 sold" : `${count.toLocaleString()} sold`
}

export function SalesMapTopSellers({
  sellers,
}: {
  sellers: MarketplaceSalesMapTopSeller[]
}) {
  return (
    <aside className="overflow-hidden rounded-xl border border-border/80 bg-white shadow-sm sm:rounded-2xl">
      <div className="flex items-center gap-2 border-b border-border/70 px-4 py-3">
        <UserRound className="h-3.5 w-3.5 text-[#5574AD]" aria-hidden />
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#5574AD]">
          Top 10 sellers
        </h2>
      </div>

      {sellers.length === 0 ? (
        <p className="px-4 py-6 text-sm text-[#5c6b89]">No public sellers to rank yet.</p>
      ) : (
        <ol className="divide-y divide-border/60">
          {sellers.map((seller, index) => (
            <li key={seller.id}>
              <Link
                href={seller.href}
                className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[#F4F7FB]"
              >
                <span className="w-4 shrink-0 text-center text-xs font-semibold tabular-nums text-[#5c6b89]">
                  {index + 1}
                </span>
                <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[#F4F7FB]">
                  {seller.imageSrc ? (
                    <Image
                      src={seller.imageSrc}
                      alt=""
                      fill
                      sizes="36px"
                      className="object-cover"
                      unoptimized={listingImageShouldBypassOptimization(seller.imageSrc)}
                    />
                  ) : (
                    <span
                      className="flex h-full w-full items-center justify-center text-xs font-semibold text-[#001A4A]"
                      aria-hidden
                    >
                      {seller.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex min-w-0 items-center gap-1 font-semibold text-[#001A4A]">
                    <span className="truncate text-sm">{seller.name}</span>
                    {seller.shopVerified ? <VerifiedBadge size="sm" /> : null}
                  </p>
                  <p className="text-xs tabular-nums text-[#5c6b89]">{salesLabel(seller.salesCount)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </aside>
  )
}
