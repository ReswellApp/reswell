import { listingIsOnVacation } from "@/lib/listing-vacation-mode"
import {
  PEER_LISTING_SECTION_LABELS,
  isPeerListingSection,
  sellerProfileSectionSortRank,
} from "@/lib/peer-listing-sections"
import { capitalizeWords } from "@/lib/listing-labels"

export type ListingsDeskAnalyticsInput = {
  id: string
  title: string
  price: number
  status: string
  section: string
  views: number
  cartCount: number
  favoriteCount: number
  hidden_from_site: boolean | null
  created_at: string
}

export type ListingsDeskSectionStat = {
  section: string
  label: string
  count: number
  views: number
  valueUsd: number
}

export type ListingsDeskTopListing = {
  id: string
  title: string
  views: number
  saves: number
  carts: number
}

export type ListingsDeskAnalytics = {
  total: number
  active: number
  drafts: number
  vacation: number
  sold: number
  inventoryValueUsd: number
  soldValueUsd: number
  averageActivePriceUsd: number | null
  totalViews: number
  totalSaves: number
  totalCarts: number
  saveRate: number | null
  cartRate: number | null
  averageViews: number | null
  listedThisMonth: number
  bySection: ListingsDeskSectionStat[]
  topByViews: ListingsDeskTopListing[]
}

function sectionLabel(section: string): string {
  if (isPeerListingSection(section)) return PEER_LISTING_SECTION_LABELS[section]
  if (section === "used") return "Surfboard"
  return capitalizeWords(section.replace(/[-_]/g, " ")) || "Other"
}

function isListedThisMonth(createdAt: string, now: Date): boolean {
  const created = new Date(createdAt)
  if (Number.isNaN(created.getTime())) return false
  return created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth()
}

export function buildListingsDeskAnalytics(
  listings: ListingsDeskAnalyticsInput[],
  now: Date = new Date(),
): ListingsDeskAnalytics {
  let active = 0
  let drafts = 0
  let vacation = 0
  let sold = 0
  let inventoryValueUsd = 0
  let soldValueUsd = 0
  let activePriceSum = 0
  let totalViews = 0
  let totalSaves = 0
  let totalCarts = 0
  let listedThisMonth = 0
  const sections = new Map<string, ListingsDeskSectionStat>()

  for (const listing of listings) {
    const price = Number.isFinite(listing.price) ? listing.price : 0
    totalViews += listing.views
    totalSaves += listing.favoriteCount
    totalCarts += listing.cartCount
    if (isListedThisMonth(listing.created_at, now)) listedThisMonth += 1

    const onVacation = listingIsOnVacation({
      status: listing.status,
      hiddenFromSite: listing.hidden_from_site,
    })
    if (listing.status === "draft") drafts += 1
    else if (listing.status === "sold") {
      sold += 1
      soldValueUsd += price
    } else if (onVacation) vacation += 1
    else if (listing.status === "active" || listing.status === "pending_sale") {
      active += 1
      inventoryValueUsd += price
      activePriceSum += price
    }

    const current = sections.get(listing.section) ?? {
      section: listing.section,
      label: sectionLabel(listing.section),
      count: 0,
      views: 0,
      valueUsd: 0,
    }
    current.count += 1
    current.views += listing.views
    if (listing.status !== "sold" && listing.status !== "draft") current.valueUsd += price
    sections.set(listing.section, current)
  }

  const bySection = [...sections.values()].sort((a, b) => {
    const rank = sellerProfileSectionSortRank(a.section) - sellerProfileSectionSortRank(b.section)
    if (rank !== 0) return rank
    return b.count - a.count
  })

  const topByViews = [...listings]
    .sort((a, b) => b.views - a.views || b.favoriteCount - a.favoriteCount)
    .slice(0, 5)
    .map((listing) => ({
      id: listing.id,
      title: listing.title.trim() || "Untitled listing",
      views: listing.views,
      saves: listing.favoriteCount,
      carts: listing.cartCount,
    }))

  const activeForAverage = active
  return {
    total: listings.length,
    active,
    drafts,
    vacation,
    sold,
    inventoryValueUsd,
    soldValueUsd,
    averageActivePriceUsd: activeForAverage > 0 ? activePriceSum / activeForAverage : null,
    totalViews,
    totalSaves,
    totalCarts,
    saveRate: totalViews > 0 ? totalSaves / totalViews : null,
    cartRate: totalViews > 0 ? totalCarts / totalViews : null,
    averageViews: listings.length > 0 ? totalViews / listings.length : null,
    listedThisMonth,
    bySection,
    topByViews,
  }
}
