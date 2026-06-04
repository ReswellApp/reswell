"use client"

import { useMemo, useState } from "react"
import { Package, Search, Truck } from "lucide-react"
import { HomePeerListingScrollTile } from "@/components/features/home/home-peer-listing-scroll-tile"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { LISTING_CONDITION_LABELS } from "@/lib/listing-labels"
import type { SellerDirectoryTileMeta } from "@/lib/sellers/directory-tile-meta"
import { sellerProfileListingsGridClassName } from "@/lib/sellers/seller-profile-layout"

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

function PromoCard({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-border/80 bg-card px-4 py-3.5">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
        {icon}
      </span>
      <p className="text-sm font-medium leading-snug text-foreground">{children}</p>
    </div>
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
  const [sectionFilter, setSectionFilter] = useState("all")
  const [conditionFilter, setConditionFilter] = useState("all")
  const [sort, setSort] = useState<SortOption>("relevant")

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

  return (
    <div className="space-y-5">
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

      {showPromoCards && (tileMeta.offersShipping || tileMeta.locatedInLabel) ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          {tileMeta.offersShipping ? (
            <PromoCard icon={<Truck className="h-4 w-4" aria-hidden />}>
              {tileMeta.shipFromState
                ? `Ships from ${tileMeta.shipFromState}. Seller offers shipping on select listings.`
                : "Seller offers shipping on select listings."}
            </PromoCard>
          ) : null}
          {tileMeta.locatedInLabel ? (
            <PromoCard icon={<Package className="h-4 w-4" aria-hidden />}>
              {tileMeta.locatedInLabel}. Local pickup may be available.
            </PromoCard>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search listings"
            className="h-10 rounded-full border-border/80 bg-muted/30 pl-10 sm:h-11"
          />
        </div>
        <p className="shrink-0 text-xs text-muted-foreground sm:text-sm">
          {filteredListings.length} listing{filteredListings.length !== 1 ? "s" : ""} found
          {noActiveListingsNotice ? " (sold)" : ""}
        </p>
      </div>

      <div className="flex flex-col gap-2.5 sm:gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 gap-2">
          <Select value={sectionFilter} onValueChange={setSectionFilter}>
            <SelectTrigger className="h-9 min-w-0 flex-1 rounded-full bg-background sm:w-[140px] sm:flex-none">
              <SelectValue placeholder="Section" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sections</SelectItem>
              {sectionOptions.map((section) => (
                <SelectItem key={section} value={section}>
                  {section.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={conditionFilter} onValueChange={setConditionFilter}>
            <SelectTrigger className="h-9 min-w-0 flex-1 rounded-full bg-background sm:w-[150px] sm:flex-none">
              <SelectValue placeholder="Condition" />
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
        </div>

        <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground sm:text-sm">
          <span className="shrink-0">Sort:</span>
          <Select value={sort} onValueChange={(value) => setSort(value as SortOption)}>
            <SelectTrigger className="h-9 min-w-0 flex-1 rounded-full border-0 bg-transparent px-2 font-semibold text-foreground shadow-none sm:w-[160px] sm:flex-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="relevant">Most relevant</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="price_asc">Price: low to high</SelectItem>
              <SelectItem value="price_desc">Price: high to low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredListings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 py-14 text-center">
          <Package className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden />
          <p className="mt-3 text-muted-foreground">{emptyMessage}</p>
        </div>
      ) : (
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
      )}
    </div>
  )
}
