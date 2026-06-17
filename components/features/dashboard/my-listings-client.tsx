"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { format } from "date-fns"
import { listingDetailHref } from "@/lib/listing-href"
import { listingCardImageSrc } from "@/lib/listing-image-display"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Package,
  Eye,
  ShoppingCart,
  Heart,
  Edit,
  Trash2,
  Plus,
  Search,
} from "lucide-react"
import { toast } from "sonner"
import {
  capitalizeWords,
  formatHomePeerListingConditionLine,
} from "@/lib/listing-labels"
import { EndListingDialog } from "@/components/end-listing-dialog"
import type { MyListingRow, MyListingsDashboardStats } from "@/lib/db/my-listings"
import { cn } from "@/lib/utils"

type SortOption = "recent" | "oldest" | "price_desc" | "price_asc" | "views"

interface MyListingsClientProps {
  listings: MyListingRow[]
  stats: MyListingsDashboardStats
  fetchError?: string
}

function listingRowImageSrc(listing: MyListingRow): string | null {
  const src = listingCardImageSrc(listing.listing_images ?? null)
  return src || null
}

function listingBrandLine(listing: MyListingRow): string | null {
  const parts = [listing.brand?.trim(), listing.model?.trim()].filter(Boolean)
  if (parts.length > 0) return parts.join(" — ")
  return null
}

function listingDetailLine(listing: MyListingRow): string | null {
  const condition = formatHomePeerListingConditionLine(listing.condition)
  if (condition) return condition
  if (listing.status === "draft") return "Draft"
  return null
}

function sortListings(listings: MyListingRow[], sort: SortOption): MyListingRow[] {
  const next = [...listings]
  switch (sort) {
    case "oldest":
      return next.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      )
    case "price_desc":
      return next.sort((a, b) => b.price - a.price)
    case "price_asc":
      return next.sort((a, b) => a.price - b.price)
    case "views":
      return next.sort((a, b) => b.views - a.views)
    case "recent":
    default:
      return next.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
  }
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Package
  label: string
  value: number
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/70 px-4 py-3.5">
      <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
        <span className="truncate">{label}</span>
      </div>
      <span className="shrink-0 text-lg font-bold tabular-nums tracking-tight text-foreground">
        {value.toLocaleString()}
      </span>
    </div>
  )
}

export function MyListingsClient({ listings, stats, fetchError }: MyListingsClientProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [sort, setSort] = useState<SortOption>("recent")
  const [endListingId, setEndListingId] = useState<string | null>(null)

  async function handleDiscardDraft(id: string) {
    const res = await fetch(`/api/listings/discard-draft?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    })
    if (!res.ok) {
      toast.error("Could not discard draft")
      return
    }
    router.refresh()
  }

  const getListingHref = (section: string, id: string, slug?: string | null) =>
    listingDetailHref({ id, slug, section })

  const visibleListings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const filtered = q
      ? listings.filter((listing) => {
          const haystack = [
            listing.title,
            listing.brand,
            listing.model,
            listing.status,
            listing.section,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
          return haystack.includes(q)
        })
      : listings
    return sortListings(filtered, sort)
  }, [listings, searchQuery, sort])

  const listingCountLabel =
    visibleListings.length === 1 ? "1 listing" : `${visibleListings.length} listings`

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Listings
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Summary of your surfboard inventory and performance.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          <Link
            href="/dashboard/listings/archived"
            className="text-sm font-medium text-primary hover:underline"
          >
            Archived listings
          </Link>
          <Button asChild size="sm" className="rounded-full">
            <Link href="/sell?new=1">
              <Plus className="h-4 w-4" />
              New listing
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Package} label="Total Listings" value={stats.totalListings} />
        <StatCard icon={Eye} label="Total Views" value={stats.totalViews} />
        <StatCard icon={ShoppingCart} label="In Carts" value={stats.inCarts} />
        <StatCard icon={Heart} label="Saved" value={stats.saved} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search your listings"
            className="h-11 rounded-full border-muted-foreground/15 bg-muted/40 pl-11 shadow-none"
            aria-label="Search your listings"
          />
        </div>
        <Select value={sort} onValueChange={(value) => setSort(value as SortOption)}>
          <SelectTrigger
            className="h-11 w-full rounded-full border-muted-foreground/15 bg-muted/40 shadow-none sm:w-[220px]"
            aria-label="Sort listings"
          >
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Sort: Most Recent</SelectItem>
            <SelectItem value="oldest">Sort: Oldest First</SelectItem>
            <SelectItem value="price_desc">Sort: Price High to Low</SelectItem>
            <SelectItem value="price_asc">Sort: Price Low to High</SelectItem>
            <SelectItem value="views">Sort: Most Views</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {fetchError && (
        <p className="text-sm text-destructive">Could not load listings. Please refresh the page.</p>
      )}

      {!fetchError && listings.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Package className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold text-foreground">No listings yet</h3>
            <p className="mb-4 text-muted-foreground">
              Start selling by creating your first listing
            </p>
            <Button asChild className="rounded-full">
              <Link href="/sell?new=1">
                <Plus className="h-4 w-4" />
                Create listing
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-sm font-semibold text-muted-foreground">{listingCountLabel}</p>

          {visibleListings.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No listings match your search.
            </p>
          ) : (
            <div className="divide-y divide-border/80">
              {visibleListings.map((listing) => (
                <ListingRow
                  key={listing.id}
                  listing={listing}
                  getListingHref={getListingHref}
                  onDiscardDraft={handleDiscardDraft}
                  onEndListing={setEndListingId}
                />
              ))}
            </div>
          )}
        </>
      )}

      <EndListingDialog
        listingId={endListingId}
        open={!!endListingId}
        onOpenChange={(open) => {
          if (!open) setEndListingId(null)
        }}
      />
    </div>
  )
}

function ListingRow({
  listing,
  getListingHref,
  onDiscardDraft,
  onEndListing,
}: {
  listing: MyListingRow
  getListingHref: (section: string, id: string, slug?: string | null) => string
  onDiscardDraft: (id: string) => void
  onEndListing: (id: string) => void
}) {
  const imageSrc = listingRowImageSrc(listing)
  const isDraft = listing.status === "draft"
  const cardHref = isDraft
    ? `/sell?edit=${listing.id}`
    : getListingHref(listing.section, listing.id, listing.slug)
  const brandLine = listingBrandLine(listing)
  const detailLine = listingDetailLine(listing)
  const listedDate = format(new Date(listing.created_at), "MMM d, yyyy")
  const canEnd = !isDraft && listing.status !== "sold"

  return (
    <article className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:gap-5">
      <Link
        href={cardHref}
        className="relative w-[4.5rem] shrink-0 overflow-hidden rounded-lg bg-muted aspect-[3/4] sm:w-20"
      >
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt={capitalizeWords(listing.title)}
            fill
            className="object-cover object-center"
            sizes="80px"
            unoptimized={listingImageShouldBypassOptimization(imageSrc)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Package className="h-7 w-7 text-muted-foreground" />
          </div>
        )}
      </Link>

      <div className="min-w-0 flex-1">
        <Link
          href={cardHref}
          className="block truncate font-semibold text-foreground hover:text-primary"
        >
          {capitalizeWords(listing.title)}
        </Link>
        {brandLine ? (
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{brandLine}</p>
        ) : null}
        <p className="mt-1 text-base font-semibold text-primary tabular-nums">
          {isDraft ? (
            <span className="font-medium text-muted-foreground">Draft</span>
          ) : (
            `$${listing.price.toFixed(2)}`
          )}
        </p>
        {detailLine ? (
          <p className="mt-0.5 text-sm text-muted-foreground">{detailLine}</p>
        ) : null}
        {!isDraft && listing.status !== "active" ? (
          <p className="mt-0.5 text-xs capitalize text-muted-foreground">{listing.status}</p>
        ) : null}
      </div>

      <p className="hidden shrink-0 text-sm text-muted-foreground md:block md:min-w-[8.5rem] md:text-center">
        Listed: {listedDate}
      </p>

      <div className="flex shrink-0 flex-row gap-2 sm:flex-col sm:gap-2">
        <Button
          asChild
          size="sm"
          className={cn(
            "min-w-[5.5rem] rounded-full bg-primary/10 text-primary shadow-none hover:bg-primary/15",
            "dark:bg-primary/15 dark:hover:bg-primary/20",
          )}
        >
          <Link href={`/sell?edit=${listing.id}`}>
            <Edit className="h-3.5 w-3.5" />
            Edit
          </Link>
        </Button>
        {isDraft ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="min-w-[5.5rem] rounded-full bg-muted text-primary shadow-none hover:bg-muted/80"
            onClick={() => onDiscardDraft(listing.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        ) : canEnd ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="min-w-[5.5rem] rounded-full bg-muted text-primary shadow-none hover:bg-muted/80"
            onClick={() => onEndListing(listing.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            End
          </Button>
        ) : null}
      </div>
    </article>
  )
}
