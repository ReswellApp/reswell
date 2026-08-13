"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowUpRight, Clock, Eye } from "lucide-react"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import type { PickupOnlySurfboardListing } from "@/lib/types/pickupOnlySurfboards"

function formatUsd(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  })
}

export function PickupOnlySurfboardsListingTable({
  listings,
}: {
  listings: PickupOnlySurfboardListing[]
}) {
  if (listings.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        No pickup-only boards match this filter.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Listing</th>
            <th className="px-3 py-2 font-medium">Location</th>
            <th className="px-3 py-2 font-medium text-right">Price</th>
            <th className="px-3 py-2 font-medium text-right">Age</th>
            <th className="px-3 py-2 font-medium text-right">Views</th>
          </tr>
        </thead>
        <tbody>
          {listings.map((listing) => {
            const location =
              listing.city && listing.state
                ? `${listing.city}, ${listing.state}`
                : listing.city || listing.state || "Unknown"
            const meta = [listing.brand, listing.model, listing.conditionLabel, listing.dimensions]
              .filter(Boolean)
              .join(" · ")

            return (
              <tr key={listing.id} className="border-b border-border last:border-0">
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    {listing.thumbnailUrl ? (
                      <Image
                        src={listing.thumbnailUrl}
                        alt=""
                        width={48}
                        height={48}
                        className="h-12 w-12 rounded-md object-cover"
                        unoptimized={listingImageShouldBypassOptimization(listing.thumbnailUrl)}
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-md bg-muted" />
                    )}
                    <div className="min-w-0">
                      <Link
                        href={listing.href}
                        className="font-medium hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {listing.title}
                        <ArrowUpRight className="ml-1 inline h-3 w-3" />
                      </Link>
                      {meta ? (
                        <p className="truncate text-xs text-muted-foreground">{meta}</p>
                      ) : null}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">{location}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatUsd(listing.price)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                  <span className="inline-flex items-center justify-end gap-1">
                    <Clock className="h-3 w-3" aria-hidden />
                    {listing.daysListed}d
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                  <span className="inline-flex items-center justify-end gap-1">
                    <Eye className="h-3 w-3" aria-hidden />
                    {listing.views.toLocaleString("en-US")}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
