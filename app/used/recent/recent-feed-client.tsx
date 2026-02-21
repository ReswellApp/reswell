"use client"

import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatCondition, formatCategory, capitalizeWords, getPublicSellerDisplayName } from "@/lib/listing-labels"
import { MessageListingButton } from "@/components/message-listing-button"
import { RefreshCw, LayoutGrid, List, Package } from "lucide-react"

function listingHref(listing: RecentListing): string {
  return listing.section === "surfboards" ? `/boards/${listing.id}` : `/used/${listing.id}`
}
import { cn } from "@/lib/utils"

export type RecentListing = {
  id: string
  user_id: string
  title: string
  price: number
  condition: string | null
  section?: string
  listing_images: { url: string; is_primary: boolean }[] | null
  profiles: { display_name: string | null; avatar_url: string | null; sales_count: number | null } | null
  categories: { name: string; slug: string } | null
}

const LIMIT = 50

export function RecentFeedClient({ listings }: { listings: RecentListing[] }) {
  const router = useRouter()
  const [view, setView] = useState<"grid" | "list">("grid")
  const count = listings?.length ?? 0

  return (
    <>
      {/* Control bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-background/80 py-3">
        <div className="flex flex-wrap items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-border text-foreground hover:bg-muted/60"
            onClick={() => router.refresh()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          <span className="text-sm text-muted-foreground">
            Show <span className="font-medium text-foreground">{LIMIT}</span> per page
          </span>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-0.5">
          <button
            type="button"
            onClick={() => setView("grid")}
            className={cn(
              "rounded-md p-2 transition-colors",
              view === "grid" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
            aria-label="Grid view"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setView("list")}
            className={cn(
              "rounded-md p-2 transition-colors",
              view === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
            aria-label="List view"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Count label */}
      <p className="mt-4 text-sm text-muted-foreground">
        {count === 0 ? "No listings yet." : `${count} most recently added listing${count === 1 ? "" : "s"}`}
      </p>

      {/* Feed */}
      {count > 0 && view === "grid" && (
        <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}

      {count > 0 && view === "list" && (
        <ul className="mt-4 space-y-2">
          {listings.map((listing) => (
            <ListingRow key={listing.id} listing={listing} />
          ))}
        </ul>
      )}
    </>
  )
}

function ListingCard({ listing }: { listing: RecentListing }) {
  const primaryImage = listing.listing_images?.find((img) => img.is_primary) ?? listing.listing_images?.[0]
  const href = listingHref(listing)

  return (
    <Card className="group h-full overflow-hidden rounded-xl border-border bg-card transition-shadow hover:shadow-md">
      <Link href={href} className="flex h-full flex-col">
        <div className="aspect-square relative bg-muted">
          {primaryImage?.url ? (
            <Image
              src={primaryImage.url}
              alt={capitalizeWords(listing.title)}
              fill
              className="object-contain transition-transform duration-300 group-hover:scale-[1.02]"
              style={{ objectFit: "contain" }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              <Package className="h-12 w-12" />
            </div>
          )}
          <Badge className="absolute left-2 top-2 rounded-md" variant="secondary">
            {listing.section === "surfboards" ? "Board" : formatCondition(listing.condition)}
          </Badge>
        </div>
        <CardContent className="flex flex-1 flex-col p-4">
          <h3 className="font-medium line-clamp-2">{capitalizeWords(listing.title)}</h3>
          <p className="mt-2 text-xl font-bold text-foreground">${listing.price.toFixed(2)}</p>
          <div className="mt-auto flex items-center justify-between pt-2">
            <p className="text-sm text-muted-foreground">{getPublicSellerDisplayName(listing.profiles)}</p>
            {listing.categories?.name && (
              <Badge variant="outline" className="text-xs">
                {formatCategory(listing.categories.name)}
              </Badge>
            )}
          </div>
        </CardContent>
      </Link>
      <div className="border-t border-border px-4 py-3">
        <MessageListingButton
          listingId={listing.id}
          sellerId={listing.user_id}
          redirectPath={href}
        />
      </div>
    </Card>
  )
}

function ListingRow({ listing }: { listing: RecentListing }) {
  const primaryImage = listing.listing_images?.find((img) => img.is_primary) ?? listing.listing_images?.[0]
  const href = listingHref(listing)

  return (
    <li>
      <Card className="overflow-hidden rounded-xl border-border bg-card transition-shadow hover:shadow-sm">
        <Link href={href} className="flex flex-row gap-4 p-3 sm:gap-5">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted sm:h-24 sm:w-24">
            {primaryImage?.url ? (
              <Image
                src={primaryImage.url}
                alt={capitalizeWords(listing.title)}
                fill
                className="object-contain"
                style={{ objectFit: "contain" }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <Package className="h-8 w-8" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 py-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-md" variant="secondary">
                {listing.section === "surfboards" ? "Board" : formatCondition(listing.condition)}
              </Badge>
              {listing.categories?.name && (
                <Badge variant="outline" className="text-xs">
                  {formatCategory(listing.categories.name)}
                </Badge>
              )}
            </div>
            <h3 className="mt-1 font-medium line-clamp-1 sm:line-clamp-2">{capitalizeWords(listing.title)}</h3>
            <p className="mt-0.5 text-lg font-bold text-foreground">${listing.price.toFixed(2)}</p>
            <p className="text-sm text-muted-foreground">{getPublicSellerDisplayName(listing.profiles)}</p>
          </div>
        </Link>
        <div className="border-t border-border px-3 py-2 sm:px-4">
          <MessageListingButton
            listingId={listing.id}
            sellerId={listing.user_id}
            redirectPath={href}
          />
        </div>
      </Card>
    </li>
  )
}
