"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { LayoutGrid, List, Package, Search } from "lucide-react"
import { HomePeerListingScrollTile } from "@/components/features/home/home-peer-listing-scroll-tile"
import { FavoriteButton } from "@/components/favorite-button"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  capitalizeWords,
  formatHomePeerListingConditionLine,
  LISTING_CONDITION_LABELS,
} from "@/lib/listing-labels"
import { listingCardImageSrc } from "@/lib/listing-image-display"
import { listingDetailHref } from "@/lib/listing-href"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import { sellerProfileSectionSortRank } from "@/lib/peer-listing-sections"
import type { SellerDirectoryTileMeta } from "@/lib/sellers/directory-tile-meta"
import {
  sellerProfileListingsGridClassName,
  sellerProfileListingsListClassName,
} from "@/lib/sellers/seller-profile-layout"
import { cn } from "@/lib/utils"

export type SellerProfileListing = {
  id: string
  slug: string | null
  user_id: string
  title: string
  price: string | number
  status: string | null
  section: string
  local_pickup?: boolean | null
  shipping_available?: boolean | null
  condition?: string | null
  created_at?: string | null
  listing_images?: { url: string; is_primary?: boolean | null }[] | null
  categories?: { name?: string | null; slug?: string | null } | null
  board_type?: string | null
}

type SortOption = "relevant" | "newest" | "price_asc" | "price_desc"
type ViewMode = "grid" | "list"

type SellerProfileListingsPanelProps = {
  listings: SellerProfileListing[]
  favoritedIds: string[]
  viewerId: string | null
  tileMeta: SellerDirectoryTileMeta
  emptyMessage?: string
  showPromoCards?: boolean
  /** Shown when the Listings tab is displaying sold/history because nothing is active. */
  noActiveListingsNotice?: boolean
  onViewSoldTab?: () => void
}

function listingStatusLabel(
  listing: SellerProfileListing,
): "sold" | "pending" | "ended" | null {
  if (!listing.status || listing.status === "active") return null
  if (listing.status === "sold") return "sold"
  if (listing.status === "pending" || listing.status === "pending_sale") return "pending"
  return "ended"
}

function listingPrice(listing: SellerProfileListing): number {
  const value = typeof listing.price === "number" ? listing.price : Number.parseFloat(String(listing.price))
  return Number.isFinite(value) ? value : 0
}

function filterPillTriggerClassName(active: boolean) {
  return cn(
    "h-9 w-auto shrink-0 gap-3 rounded-full border px-7 text-xs font-semibold shadow-none sm:px-8 sm:text-sm",
    "focus:outline-none focus:ring-0 focus:ring-offset-0 [&>span]:line-clamp-none [&>svg]:shrink-0 [&>svg]:opacity-60",
    active
      ? "border-foreground bg-foreground text-background hover:bg-foreground/90"
      : "border-border/80 bg-background text-foreground hover:bg-muted/40",
  )
}

function ViewModeToggle({
  viewMode,
  onChange,
}: {
  viewMode: ViewMode
  onChange: (mode: ViewMode) => void
}) {
  return (
    <div
      className="inline-flex shrink-0 rounded-full border border-border/80 p-0.5"
      role="group"
      aria-label="Listing view"
    >
      <button
        type="button"
        aria-pressed={viewMode === "grid"}
        aria-label="Grid view"
        onClick={() => onChange("grid")}
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors",
          viewMode === "grid" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <LayoutGrid className="h-4 w-4" aria-hidden />
      </button>
      <button
        type="button"
        aria-pressed={viewMode === "list"}
        aria-label="List view"
        onClick={() => onChange("list")}
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors",
          viewMode === "list" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <List className="h-4 w-4" aria-hidden />
      </button>
    </div>
  )
}

function SellerProfileListingListRow({
  listing,
  viewerId,
  isFavorited,
  statusLabel,
}: {
  listing: SellerProfileListing
  viewerId: string | null
  isFavorited: boolean
  statusLabel: "sold" | "pending" | "ended" | null
}) {
  const imageSrc = listingCardImageSrc(listing.listing_images)
  const conditionLine = formatHomePeerListingConditionLine(listing.condition)
  const price = listingPrice(listing)

  return (
    <article className="group relative rounded-xl border border-border/80 bg-card transition-colors hover:border-border">
      <Link
        href={listingDetailHref({
          id: listing.id,
          slug: listing.slug,
          section: listing.section,
        })}
        className="flex min-w-0 items-stretch gap-3 p-2.5 sm:gap-4 sm:p-3"
      >
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-muted sm:h-28 sm:w-28">
          {imageSrc ? (
            <Image
              src={imageSrc}
              alt=""
              fill
              sizes="112px"
              className="object-cover"
              unoptimized={listingImageShouldBypassOptimization(imageSrc)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground" aria-hidden>
              <Package className="h-8 w-8" />
            </div>
          )}
          {statusLabel === "sold" ? (
            <span className="absolute left-1.5 top-1.5 rounded-full bg-[#111] px-2 py-0.5 text-[10px] font-semibold text-white">
              SOLD
            </span>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 pr-10">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground sm:text-base">
            {capitalizeWords(listing.title)}
          </h3>
          {conditionLine ? (
            <p className="text-xs text-muted-foreground sm:text-sm">{conditionLine}</p>
          ) : null}
          <p className="text-base font-bold tabular-nums text-foreground sm:text-lg">${price.toFixed(2)}</p>
        </div>
      </Link>

      <div className="absolute right-3 top-3 sm:right-4 sm:top-4">
        <FavoriteButton
          listingId={listing.id}
          initialFavorited={isFavorited}
          isLoggedIn={!!viewerId}
          className="h-8 w-8 rounded-full border border-neutral-200/90 bg-white/90 shadow-sm"
          heartAccent="listingTile"
        />
      </div>
    </article>
  )
}

export function SellerProfileListingsPanel({
  listings,
  favoritedIds,
  viewerId,
  tileMeta,
  emptyMessage = "No listings in this category yet.",
  showPromoCards = true,
  noActiveListingsNotice = false,
  onViewSoldTab,
}: SellerProfileListingsPanelProps) {
  const [query, setQuery] = useState("")
  const [viewMode, setViewMode] = useState<ViewMode>("grid")
  const [sectionFilter, setSectionFilter] = useState("all")
  const [conditionFilter, setConditionFilter] = useState("all")
  const [sort, setSort] = useState<SortOption>("newest")

  const sectionOptions = useMemo(() => {
    const sections = new Set<string>()
    for (const listing of listings) {
      if (listing.section?.trim()) sections.add(listing.section.trim())
    }
    return Array.from(sections).sort()
  }, [listings])

  const conditionOptions = useMemo(() => {
    const conditions = new Set<string>()
    for (const listing of listings) {
      if (listing.condition?.trim()) conditions.add(listing.condition.trim())
    }
    return Array.from(conditions).sort()
  }, [listings])

  const filteredListings = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    let result = listings.filter((listing) => {
      if (sectionFilter !== "all" && listing.section !== sectionFilter) return false
      if (conditionFilter !== "all" && listing.condition !== conditionFilter) return false
      if (!normalizedQuery) return true
      return listing.title.toLowerCase().includes(normalizedQuery)
    })

    result = [...result].sort((a, b) => {
      if (sectionFilter === "all") {
        const sectionRank =
          sellerProfileSectionSortRank(a.section) -
          sellerProfileSectionSortRank(b.section)
        if (sectionRank !== 0) return sectionRank
      }
      if (sort === "price_asc") return listingPrice(a) - listingPrice(b)
      if (sort === "price_desc") return listingPrice(b) - listingPrice(a)
      if (sort === "newest") {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0
        return bTime - aTime
      }
      return 0
    })

    return result
  }, [listings, query, sectionFilter, conditionFilter, sort])

  const activeSectionLabel =
    sectionFilter === "all"
      ? "Category"
      : sectionFilter.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())

  const activeConditionLabel =
    conditionFilter === "all"
      ? "Condition"
      : (LISTING_CONDITION_LABELS[conditionFilter] ?? conditionFilter)

  return (
    <div className="space-y-4 sm:space-y-5">
      {noActiveListingsNotice ? (
        <div className="rounded-xl border border-border/80 bg-muted/30 px-4 py-3.5 sm:px-5 sm:py-4">
          <p className="text-sm font-semibold text-foreground">No active listings right now</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            This seller doesn&apos;t have anything for sale at the moment. Their sold listings are shown below
            {onViewSoldTab ? (
              <>
                {" "}
                — or open the{" "}
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-sm font-semibold text-listingHeart"
                  onClick={onViewSoldTab}
                >
                  Sold tab
                </Button>{" "}
                for the full history.
              </>
            ) : (
              "."
            )}
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-foreground">
          {filteredListings.length.toLocaleString()} Result{filteredListings.length !== 1 ? "s" : ""}
          {noActiveListingsNotice ? " (sold)" : ""}
        </p>

        <div className="relative min-w-0 sm:max-w-xs sm:flex-1 lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search this shop"
            className="h-10 rounded-full border-border/80 bg-background pl-10 sm:h-11"
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-2 overflow-x-auto pb-0.5">
          {sectionOptions.length > 0 ? (
            <Select value={sectionFilter} onValueChange={setSectionFilter}>
              <SelectTrigger className={filterPillTriggerClassName(sectionFilter !== "all")}>
                <span className="whitespace-nowrap">{activeSectionLabel}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {sectionOptions.map((section) => (
                  <SelectItem key={section} value={section}>
                    {section.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          {conditionOptions.length > 0 ? (
            <Select value={conditionFilter} onValueChange={setConditionFilter}>
              <SelectTrigger className={filterPillTriggerClassName(conditionFilter !== "all")}>
                <span className="whitespace-nowrap">{activeConditionLabel}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All conditions</SelectItem>
                {conditionOptions.map((condition) => (
                  <SelectItem key={condition} value={condition}>
                    {LISTING_CONDITION_LABELS[condition] ?? condition}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          {showPromoCards && tileMeta.locatedInLabel ? (
            <span className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full border border-border/80 px-3.5 text-xs font-semibold text-muted-foreground sm:text-sm">
              {tileMeta.locatedInLabel}
            </span>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="shrink-0 font-medium">Sort by</span>
            <Select value={sort} onValueChange={(value) => setSort(value as SortOption)}>
              <SelectTrigger className="h-9 min-w-[180px] rounded-full border-border/80 bg-background font-semibold text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Most Recent First</SelectItem>
                <SelectItem value="relevant">Most Relevant</SelectItem>
                <SelectItem value="price_asc">Price: Low to High</SelectItem>
                <SelectItem value="price_desc">Price: High to Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {filteredListings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 py-14 text-center">
          <Package className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden />
          <p className="mt-3 text-muted-foreground">{emptyMessage}</p>
        </div>
      ) : viewMode === "grid" ? (
        <div className={sellerProfileListingsGridClassName}>
          {filteredListings.map((listing) => (
            <HomePeerListingScrollTile
              key={listing.id}
              layout="grid"
              userId={viewerId}
              isFavorited={favoritedIds.includes(listing.id)}
              statusLabel={listingStatusLabel(listing)}
              listing={{
                id: listing.id,
                slug: listing.slug,
                user_id: listing.user_id,
                title: listing.title,
                price: listing.price,
                status: listing.status ?? "active",
                section: listing.section,
                local_pickup: listing.local_pickup,
                shipping_available: listing.shipping_available,
                listing_images: listing.listing_images,
                categories: listing.categories,
                board_type: listing.board_type,
                condition: listing.condition,
              }}
            />
          ))}
        </div>
      ) : (
        <div className={sellerProfileListingsListClassName}>
          {filteredListings.map((listing) => (
            <SellerProfileListingListRow
              key={listing.id}
              listing={listing}
              viewerId={viewerId}
              isFavorited={favoritedIds.includes(listing.id)}
              statusLabel={listingStatusLabel(listing)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
