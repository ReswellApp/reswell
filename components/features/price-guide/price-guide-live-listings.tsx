import Image from "next/image"
import Link from "next/link"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import { formatGuideUsd } from "@/lib/price-guide/format"
import type { PriceGuideLiveListing } from "@/lib/types/price-guide"

export function PriceGuideLiveListings({
  listings,
  heading,
}: {
  listings: PriceGuideLiveListing[]
  heading: string
}) {
  if (listings.length === 0) return null

  return (
    <section className="border-t border-border/80 bg-background">
      <div className="container mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <h2 className="text-lg font-semibold text-foreground">{heading}</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {listings.map((listing) => (
            <Link
              key={listing.id}
              href={listing.href}
              className="overflow-hidden rounded-2xl border border-border/80 bg-offwhite/40"
            >
              <div className="relative aspect-[4/3] bg-muted">
                {listing.image_url ? (
                  <Image
                    src={listing.image_url}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 25vw"
                    unoptimized={listingImageShouldBypassOptimization(listing.image_url)}
                  />
                ) : null}
              </div>
              <div className="p-3">
                <p className="line-clamp-2 text-sm font-medium text-foreground">{listing.title}</p>
                <p className="mt-1 text-sm font-semibold tabular-nums">{formatGuideUsd(listing.price_usd)}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {[listing.condition_label, listing.city].filter(Boolean).join(" · ")}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
