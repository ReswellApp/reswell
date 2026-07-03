import { unstable_cache } from "next/cache"
import {
  FALLBACK_HOME_HERO_SLIDE_PATHS,
  normalizeHeroSlideUrl,
} from "@/lib/home-hero-slide-urls"
import { listHomeHeroCuratedSlideUrls } from "@/lib/db/home-hero-listings"
import type { HomeTrendingBrandRow } from "@/lib/db/home-trending-brands"
import { listingHeroSlideSrc, type ListingImageForCard } from "@/lib/listing-image-display"
import type { HomePeerScrollListing } from "@/components/features/home/home-peer-listing-scroll-tile"
import { listHomeTrendingBrandsForPublicService } from "@/lib/services/homeTrendingBrands"
import {
  loadHomeFeaturedFinRows,
  loadHomeFeaturedSurfboardRows,
} from "@/lib/services/homeFeaturedPeerSections"
import { loadHomeMostViewedMosaic, type HomeMostViewedMosaicLayout } from "@/lib/services/homeMostViewedSection"
import { loadHomeRecentlyListedGridRows } from "@/lib/services/homeRecentlyListedGridSection"
import { loadHomeRecentlySoldSurfboardRows } from "@/lib/services/homeRecentlySoldStrip"
import { createAnonSupabaseClient } from "@/lib/supabase/anon"

/** Admin-curated + stable homepage sections (hero, featured rows, shops, brands). */
export const HOME_STABLE_CATALOG_CACHE_TAG = "home-public-catalog-stable"
export const HOME_STABLE_CATALOG_REVALIDATE_SECONDS = 60 * 60 * 24 * 7

/** Auto-generated recently sold strip — refreshes on a short TTL. */
export const HOME_RECENTLY_SOLD_CACHE_TAG = "home-public-catalog-recently-sold"
export const HOME_RECENTLY_SOLD_REVALIDATE_SECONDS = 60 * 60

/** Most-viewed surfboards + fins strip — view counts change more often than curated sections. */
export const HOME_MOST_VIEWED_CACHE_TAG = "home-public-catalog-most-viewed"
export const HOME_MOST_VIEWED_REVALIDATE_SECONDS = 60 * 60

/** Recently listed 5×3 surfboards + fins grid. */
export const HOME_RECENTLY_LISTED_GRID_CACHE_TAG = "home-public-catalog-recently-listed-grid"
export const HOME_RECENTLY_LISTED_GRID_REVALIDATE_SECONDS = 60 * 60

const profilePublicFields =
  "id, seller_slug, display_name, avatar_url, location, city, bio, created_at, updated_at, is_shop, shop_name, shop_description, shop_banner_url, shop_banner_focal_x_pct, shop_banner_focal_y_pct, shop_logo_url, shop_verified, shop_website, shop_phone, shop_address, sales_count"

const featuredNewSelect = `
  id,
  slug,
  title,
  price,
  listing_images (url, thumbnail_url, sort_order, is_primary),
  stock_quantity,
  categories (name)
`

export type HomeFeaturedShop = {
  id: string
  seller_slug: string | null
  display_name: string | null
  avatar_url: string | null
  location: string | null
  city: string | null
  bio: string | null
  created_at: string | null
  updated_at: string | null
  is_shop: boolean | null
  shop_name: string | null
  shop_description: string | null
  shop_banner_url: string | null
  shop_banner_focal_x_pct: number | null
  shop_banner_focal_y_pct: number | null
  shop_logo_url: string | null
  shop_verified: boolean | null
  shop_website: string | null
  shop_phone: string | null
  shop_address: string | null
  sales_count: number | null
}

export type HomeFeaturedNewItem = {
  listing: {
    id: string
    slug: string
    title: string
    price: number
    listing_images: unknown
  }
  stockQuantity: number
  categoryName: string | null
}

export type HomeStableCatalog = {
  heroSlideUrls: string[]
  homeTrendingBrandRows: HomeTrendingBrandRow[]
  featuredShops: HomeFeaturedShop[] | null
  featuredBoards: HomePeerScrollListing[] | null
  featuredFins: HomePeerScrollListing[] | null
  featuredNew: HomeFeaturedNewItem[]
  featuredListingIds: string[]
}

export type HomeRecentlySoldCatalog = {
  featuredRecentlySold: HomePeerScrollListing[] | null
  featuredListingIds: string[]
}

export type HomeMostViewedCatalog = {
  mostViewedMosaic: HomeMostViewedMosaicLayout | null
  featuredListingIds: string[]
}

export type HomeRecentlyListedGridCatalog = {
  recentlyListedGrid: HomePeerScrollListing[] | null
  featuredListingIds: string[]
}

function buildHeroSlideUrls(
  curatedHeroUrls: string[],
  heroListingCandidates: { listing_images: unknown }[] | null,
): string[] {
  const heroSlideUrls: string[] = []
  const heroSeen = new Set<string>()

  if (curatedHeroUrls.length > 0) {
    for (const src of curatedHeroUrls) {
      const key = normalizeHeroSlideUrl(src)
      if (!key || heroSeen.has(key)) continue
      heroSeen.add(key)
      heroSlideUrls.push(src)
    }
  } else {
    for (const row of heroListingCandidates ?? []) {
      const src = listingHeroSlideSrc(row.listing_images as ListingImageForCard[] | null)
      if (!src) continue
      const key = normalizeHeroSlideUrl(src)
      if (!key || heroSeen.has(key)) continue
      heroSeen.add(key)
      heroSlideUrls.push(src)
      if (heroSlideUrls.length >= 5) break
    }
  }

  if (heroSlideUrls.length === 0) {
    heroSlideUrls.push(...FALLBACK_HOME_HERO_SLIDE_PATHS)
  }

  return heroSlideUrls
}

async function loadHomeStableCatalogUncached(): Promise<HomeStableCatalog> {
  const supabase = createAnonSupabaseClient()

  const [
    curatedHeroUrls,
    homeTrendingBrandRows,
    featuredShopsRes,
    surfboardFeaturedRows,
    finFeaturedRows,
    newGearRes,
  ] = await Promise.all([
    listHomeHeroCuratedSlideUrls(supabase),
    listHomeTrendingBrandsForPublicService(supabase),
    supabase
      .from("profiles")
      .select(profilePublicFields)
      .eq("is_shop", true)
      .order("sales_count", { ascending: false })
      .order("shop_verified", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(4),
    loadHomeFeaturedSurfboardRows(supabase),
    loadHomeFeaturedFinRows(supabase),
    supabase
      .from("listings")
      .select(featuredNewSelect)
      .eq("section", "new")
      .eq("status", "active")
      .eq("hidden_from_site", false)
      .eq("hidden_from_homepage", false)
      .order("created_at", { ascending: false })
      .limit(12),
  ])

  const useCuratedHeroOnly = curatedHeroUrls.length > 0
  const heroListingsRes = useCuratedHeroOnly
    ? { data: null as { listing_images: unknown }[] | null }
    : await supabase
        .from("listings")
        .select("listing_images (url, is_primary)")
        .eq("status", "active")
        .eq("section", "surfboards")
        .eq("hidden_from_site", false)
        .eq("hidden_from_homepage", false)
        .order("created_at", { ascending: false })
        .limit(24)

  const rawFeaturedBoards = surfboardFeaturedRows as HomePeerScrollListing[]
  const rawFeaturedFins = finFeaturedRows as HomePeerScrollListing[]

  const featuredBoards = rawFeaturedBoards.length > 0 ? rawFeaturedBoards : null
  const featuredFins = rawFeaturedFins.length > 0 ? rawFeaturedFins : null

  const featuredNew =
    newGearRes.data
      ?.map((l) => {
        const qty = Number((l as { stock_quantity?: number }).stock_quantity) || 0
        const cat = l.categories as { name?: string | null } | { name?: string | null }[] | null | undefined
        const catRow = Array.isArray(cat) ? cat[0] : cat
        return {
          listing: {
            id: l.id,
            slug: l.slug,
            title: l.title,
            price: Number(l.price),
            listing_images: l.listing_images,
          },
          stockQuantity: qty,
          categoryName: catRow?.name ?? null,
        }
      })
      .filter((x) => x.stockQuantity > 0)
      .slice(0, 4) ?? []

  const featuredListingIds = [
    ...(featuredBoards ?? []).map((b) => b.id),
    ...(featuredFins ?? []).map((b) => b.id),
    ...featuredNew.map(({ listing }) => listing.id),
  ]

  return {
    heroSlideUrls: buildHeroSlideUrls(curatedHeroUrls, heroListingsRes.data),
    homeTrendingBrandRows,
    featuredShops: (featuredShopsRes.data as HomeFeaturedShop[] | null) ?? null,
    featuredBoards,
    featuredFins,
    featuredNew,
    featuredListingIds,
  }
}

async function loadHomeRecentlySoldCatalogUncached(): Promise<HomeRecentlySoldCatalog> {
  const supabase = createAnonSupabaseClient()
  const recentlySoldFeaturedRows = await loadHomeRecentlySoldSurfboardRows(supabase)
  const rawRecentlySoldSurfboards = recentlySoldFeaturedRows as HomePeerScrollListing[]
  const featuredRecentlySold =
    rawRecentlySoldSurfboards.length > 0 ? rawRecentlySoldSurfboards : null

  return {
    featuredRecentlySold,
    featuredListingIds: (featuredRecentlySold ?? []).map((b) => b.id),
  }
}

export const getCachedHomeStableCatalog = unstable_cache(
  loadHomeStableCatalogUncached,
  ["home-stable-catalog-v3"],
  {
    revalidate: HOME_STABLE_CATALOG_REVALIDATE_SECONDS,
    tags: [HOME_STABLE_CATALOG_CACHE_TAG],
  },
)

async function loadHomeMostViewedCatalogUncached(): Promise<HomeMostViewedCatalog> {
  const supabase = createAnonSupabaseClient()
  const mostViewedMosaic = await loadHomeMostViewedMosaic(supabase)

  const featuredListingIds = mostViewedMosaic
    ? [
        mostViewedMosaic.hero.id,
        ...mostViewedMosaic.satellites.map((listing) => listing.id),
        ...mostViewedMosaic.scrollListings.map((listing) => listing.id),
      ]
    : []

  return {
    mostViewedMosaic,
    featuredListingIds,
  }
}

export const getCachedHomeRecentlySoldCatalog = unstable_cache(
  loadHomeRecentlySoldCatalogUncached,
  ["home-recently-sold-catalog-v2"],
  {
    revalidate: HOME_RECENTLY_SOLD_REVALIDATE_SECONDS,
    tags: [HOME_RECENTLY_SOLD_CACHE_TAG],
  },
)

export const getCachedHomeMostViewedCatalog = unstable_cache(
  loadHomeMostViewedCatalogUncached,
  ["home-most-viewed-catalog-v3"],
  {
    revalidate: HOME_MOST_VIEWED_REVALIDATE_SECONDS,
    tags: [HOME_MOST_VIEWED_CACHE_TAG],
  },
)

async function loadHomeRecentlyListedGridCatalogUncached(): Promise<HomeRecentlyListedGridCatalog> {
  const supabase = createAnonSupabaseClient()
  const rows = await loadHomeRecentlyListedGridRows(supabase)
  const recentlyListedGrid = rows.length > 0 ? rows : null

  return {
    recentlyListedGrid,
    featuredListingIds: (recentlyListedGrid ?? []).map((listing) => listing.id),
  }
}

export const getCachedHomeRecentlyListedGridCatalog = unstable_cache(
  loadHomeRecentlyListedGridCatalogUncached,
  ["home-recently-listed-grid-catalog-v3"],
  {
    revalidate: HOME_RECENTLY_LISTED_GRID_REVALIDATE_SECONDS,
    tags: [HOME_RECENTLY_LISTED_GRID_CACHE_TAG],
  },
)
