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
import {
  ListingVacationModeButton,
  canUseListingVacationMode,
} from "@/components/features/sell/listing-vacation-mode-button"
import { peerListingEditHref } from "@/lib/peer-listing-sections"
import { DashboardPageHeader } from "@/components/features/dashboard/dashboard-page-header"
import type { MyListingRow, MyListingsDashboardStats } from "@/lib/db/my-listings"
import { cn } from "@/lib/utils"
import {
  dashboardFilterSelectClass,
  dashboardSearchInputClass,
  listingPortraitThumbClass,
  listingPortraitThumbSizes,
} from "@/lib/utils/dashboard-display-styles"

type SortOption = "recent" | "oldest" | "price_desc" | "price_asc" | "views"
type EngagementFilter = "all" | "in_carts" | "saved"

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
  active = false,
  onClick,
}: {
  icon: typeof Package
  label: string
  value: number
  active?: boolean
  onClick?: () => void
}) {
  const className = cn(
    "flex items-center justify-between gap-3 rounded-xl px-4 py-3.5 text-left transition-colors",
    active
      ? "bg-primary/10 ring-1 ring-primary/20"
      : "bg-muted/70 hover:bg-muted",
    onClick && "cursor-pointer",
  )

  const content = (
    <>
      <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
        <span className="truncate">{label}</span>
      </div>
      <span className="shrink-0 text-lg font-bold tabular-nums tracking-tight text-foreground">
        {value.toLocaleString()}
      </span>
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        className={className}
        onClick={onClick}
        aria-pressed={active}
        aria-label={`${label}: ${value.toLocaleString()}${active ? ", filter active" : ", click to filter listings"}`}
      >
        {content}
      </button>
    )
  }

  return <div className={className}>{content}</div>
}

function ListingEngagementBadge({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Eye
  label: string
  value: number
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/70 px-3 py-2 min-w-[7.5rem]">
      <div className="flex min-w-0 items-center gap-1.5 text-[12px] text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
        <span className="truncate">{label}</span>
      </div>
      <span className="shrink-0 text-sm font-bold tabular-nums text-foreground">
        {value.toLocaleString()}
      </span>
    </div>
  )
}

export function MyListingsClient({ listings, stats, fetchError }: MyListingsClientProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [sort, setSort] = useState<SortOption>("recent")
  const [engagementFilter, setEngagementFilter] = useState<EngagementFilter>("all")
  const [endListingId, setEndListingId] = useState<string | null>(null)

  function toggleEngagementFilter(next: Exclude<EngagementFilter, "all">) {
    setEngagementFilter((current) => (current === next ? "all" : next))
  }

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
    const filtered = listings.filter((listing) => {
      if (engagementFilter === "in_carts" && listing.cartCount <= 0) return false
      if (engagementFilter === "saved" && listing.favoriteCount <= 0) return false
      if (!q) return true
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
    return sortListings(filtered, sort)
  }, [listings, searchQuery, sort, engagementFilter])

  const listingCountLabel =
    visibleListings.length === 1 ? "1 listing" : `${visibleListings.length} listings`

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Listings"
        description="Summary of your surfboard inventory and performance."
        actions={
          <>
            <Link
              href="/dashboard/listings/archived"
              className="text-[14px] font-medium text-primary hover:underline sm:text-[15px]"
            >
              Archived listings
            </Link>
            <Button asChild size="sm" className="rounded-full">
              <Link href="/sell?new=1">
                <Plus className="h-4 w-4" />
                New listing
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Package} label="Total Listings" value={stats.totalListings} />
        <StatCard icon={Eye} label="Total Views" value={stats.totalViews} />
        <StatCard
          icon={ShoppingCart}
          label="In Carts"
          value={stats.inCarts}
          active={engagementFilter === "in_carts"}
          onClick={() => toggleEngagementFilter("in_carts")}
        />
        <StatCard
          icon={Heart}
          label="Saved"
          value={stats.saved}
          active={engagementFilter === "saved"}
          onClick={() => toggleEngagementFilter("saved")}
        />
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
            className={dashboardSearchInputClass}
            aria-label="Search your listings"
          />
        </div>
        <Select value={sort} onValueChange={(value) => setSort(value as SortOption)}>
          <SelectTrigger className={dashboardFilterSelectClass} aria-label="Sort listings">
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
          <p className="text-[13px] font-medium text-muted-foreground">{listingCountLabel}</p>

          {visibleListings.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {engagementFilter === "in_carts"
                ? "No listings are in anyone's cart right now."
                : engagementFilter === "saved"
                  ? "No listings have been saved yet."
                  : "No listings match your search."}
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
                  onVacationChange={() => router.refresh()}
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
  onVacationChange,
}: {
  listing: MyListingRow
  getListingHref: (section: string, id: string, slug?: string | null) => string
  onDiscardDraft: (id: string) => void
  onEndListing: (id: string) => void
  onVacationChange: () => void
}) {
  const imageSrc = listingRowImageSrc(listing)
  const isDraft = listing.status === "draft"
  const isSold = listing.status === "sold"
  const showVacation = canUseListingVacationMode(listing.status)
  const editHref = peerListingEditHref(listing.section, listing.id)
  const cardHref = isDraft ? editHref : getListingHref(listing.section, listing.id, listing.slug)
  const brandLine = listingBrandLine(listing)
  const detailLine = listingDetailLine(listing)
  const listedDate = format(new Date(listing.created_at), "MMM d, yyyy")
  const canEnd = !isDraft && listing.status !== "sold"
  const showSavedBadge = listing.favoriteCount > 0

  return (
    <article className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center lg:gap-4 lg:py-4">
      <Link href={cardHref} className={listingPortraitThumbClass}>
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt={capitalizeWords(listing.title)}
            fill
            className="object-cover object-center"
            sizes={listingPortraitThumbSizes}
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
          className="block truncate text-[15px] font-semibold text-foreground hover:text-primary"
        >
          {capitalizeWords(listing.title)}
        </Link>
        {brandLine ? (
          <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{brandLine}</p>
        ) : null}
        <p className="mt-1 text-[15px] font-semibold text-primary tabular-nums">
          {isDraft ? (
            <span className="font-medium text-muted-foreground">Draft</span>
          ) : (
            `$${listing.price.toFixed(2)}`
          )}
        </p>
        {detailLine ? (
          <p className="mt-0.5 text-[13px] text-muted-foreground">{detailLine}</p>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-2 md:hidden">
          <ListingEngagementBadge icon={Eye} label="Views" value={listing.views} />
          {showSavedBadge ? (
            <ListingEngagementBadge icon={Heart} label="Saved" value={listing.favoriteCount} />
          ) : null}
        </div>
        {listing.hidden_from_site && !isDraft && !isSold ? (
          <p className="mt-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
            On vacation — hidden from site
          </p>
        ) : null}
        {!isDraft && listing.status !== "active" && !isSold ? (
          <p className="mt-0.5 text-[11px] capitalize text-muted-foreground">{listing.status}</p>
        ) : null}
      </div>

      <div className="hidden shrink-0 flex-col items-center gap-2 md:flex md:min-w-[9.5rem]">
        <p className="text-[13px] text-muted-foreground">Listed: {listedDate}</p>
        <div className="flex w-full flex-col gap-2">
          <ListingEngagementBadge icon={Eye} label="Views" value={listing.views} />
          {showSavedBadge ? (
            <ListingEngagementBadge icon={Heart} label="Saved" value={listing.favoriteCount} />
          ) : null}
        </div>
      </div>

      <p className="shrink-0 text-[13px] text-muted-foreground sm:min-w-[6.5rem] md:hidden">
        Listed: {listedDate}
      </p>

      <div className="flex shrink-0 flex-row gap-2 sm:flex-col sm:gap-2">
        {isSold ? (
          <span className="inline-flex min-h-9 min-w-[5.5rem] items-center justify-center rounded-full bg-muted px-4 text-sm font-semibold text-muted-foreground">
            Sold
          </span>
        ) : (
          <Button
            asChild
            size="sm"
            className={cn(
              "min-w-[5.5rem] rounded-full bg-primary/10 text-primary shadow-none hover:bg-primary/15",
              "dark:bg-primary/15 dark:hover:bg-primary/20",
            )}
          >
            <Link href={editHref}>
              <Edit className="h-3.5 w-3.5" />
              Edit
            </Link>
          </Button>
        )}
        {showVacation ? (
          <ListingVacationModeButton
            listingId={listing.id}
            vacationMode={listing.hidden_from_site === true}
            onVacationModeChange={() => onVacationChange()}
          />
        ) : null}
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
