import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { SearchCategoryFilters } from "./search-section-filters"
import type { RecentListing } from "@/components/recent-feed-client"
import { RecentFeedClient } from "@/components/recent-feed-client"
import { isElasticsearchConfigured } from "@/lib/elasticsearch/config"
import {
  meaningfulSearchTerms,
  searchListingIdsFromElasticsearch,
} from "@/lib/elasticsearch/listings-index"
import { stripMarketplaceSearchNoiseWords } from "@/lib/utils/marketplace-brand-query"
import { hydrateListingsByIds } from "@/lib/search/hydrate-listings"
import { listActiveListingsForBrand } from "@/lib/db/brand-listings"
import { boardLengthLabelFromDimensionsColumn } from "@/lib/listing-dimensions-storage"
import { resolveDirectoryBrandRowFromLabel } from "@/lib/services/brandDirectorySearch"
import {
  displayMarketplaceSearchQueryForAnalytics,
  normalizeMarketplaceSearchQueryForAnalytics,
  recordMarketplaceSearchAnalyticsEvent,
} from "@/lib/services/searchAnalytics"

const LIMIT = 48

type MarketplaceSearchResolutionMeta = {
  resultCount: number
  backend: "elasticsearch" | "supabase"
}

function sortMarketplaceBrowseCategories<T extends { name: string; board?: boolean | null }>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => {
    const sa = a.board === true ? 0 : 1
    const sb = b.board === true ? 0 : 1
    if (sa !== sb) return sa - sb
    return a.name.localeCompare(b.name)
  })
}

export async function SearchPageView({
  rawQuery,
  brandSlugFromUrl,
  categorySlugFromUrl,
  showSeoBookmark,
  analyticsOriginHeaderNav = false,
}: {
  rawQuery: string
  /** Raw `?brandSlug=` — must match `public.brands.slug` to apply. */
  brandSlugFromUrl: string
  /** Raw `?category=` segment; must match `categories.slug` to apply. */
  categorySlugFromUrl: string
  /** Shown on the canonical recent-listings URL (`/search/recent`). */
  showSeoBookmark: boolean
  /**
   * True when `/search` was opened from the header nav bar (`nq=1`), used for analytics attribution only.
   */
  analyticsOriginHeaderNav?: boolean
}) {
  const brandSlugRequested = brandSlugFromUrl.trim()
  const curatedView = !rawQuery.trim() && !brandSlugRequested

  const supabase = await createClient()

  let brandRow: { id: string; name: string; slug: string } | null = null
  if (brandSlugRequested) {
    const { data: b } = await supabase
      .from("brands")
      .select("id, name, slug")
      .eq("slug", brandSlugRequested)
      .maybeSingle()
    if (b) {
      brandRow = { id: b.id, name: b.name, slug: b.slug }
    }
  } else if (rawQuery.trim()) {
    brandRow = await resolveDirectoryBrandRowFromLabel(supabase, rawQuery)
  }

  const [{ data: { user } }, { data: categoryRows }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("categories").select("id, name, slug, board").eq("board", true),
  ])

  const sortedCategories = sortMarketplaceBrowseCategories(categoryRows ?? [])
  const requestedSlug = categorySlugFromUrl.trim()
  const matched = requestedSlug
    ? sortedCategories.find((c) => c.slug === requestedSlug)
    : undefined
  const selectedSlug = matched?.slug ?? null
  const categorySlugForLog = matched?.slug ?? null

  const brandUnknown = Boolean(brandSlugRequested && !brandRow)

  const { listings, searchMeta } = await resolveSearchListings(
    supabase,
    rawQuery,
    matched ? { id: matched.id, name: matched.name } : null,
    brandUnknown ? null : brandRow,
  )

  if (rawQuery.trim() && searchMeta) {
    // Await so the ES index completes in this request (Next.js `after()` work can be cut short
    // when the invocation ends, especially in serverless). Failures are logged inside the service.
    await recordMarketplaceSearchAnalyticsEvent({
      queryDisplay: displayMarketplaceSearchQueryForAnalytics(rawQuery),
      queryNormalized: normalizeMarketplaceSearchQueryForAnalytics(rawQuery),
      resultCount: searchMeta.resultCount,
      backend: searchMeta.backend,
      categorySlug: categorySlugForLog,
      ...(analyticsOriginHeaderNav ? { originSurface: "header_nav" as const } : {}),
    })
  }

  let favoritedListingIds: string[] = []
  if (user) {
    const { data: favs } = await supabase
      .from("favorites")
      .select("listing_id")
      .eq("user_id", user.id)
    favoritedListingIds = (favs ?? []).map((f) => f.listing_id)
  }

  return (
    <main className="flex-1">
      <section className="border-b bg-background">
        <div className="container mx-auto py-6 md:py-8">
          <h1 className="text-xl font-bold text-foreground md:text-2xl">
            {brandUnknown ? (
              <>Brand not found</>
            ) : brandRow ? (
              <>
                {rawQuery.trim() ? (
                  <>Results for &ldquo;{rawQuery}&rdquo; — {brandRow.name}</>
                ) : (
                  <>Listings — {brandRow.name}</>
                )}
              </>
            ) : rawQuery ? (
              <>Results for &ldquo;{rawQuery}&rdquo;</>
            ) : (
              <>Recently listed for you</>
            )}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {brandUnknown ? (
              <>Check the spelling or search from the header — that slug is not in our brand directory.</>
            ) : brandRow ? (
              <>
                Active marketplace listings for this brand
                {rawQuery.trim() ? " (matched from your search)" : ""} — including listings linked by
                brand directory and legacy title text.
              </>
            ) : rawQuery ? (
              <>
                Use the search bar in the header to refine results.
                {isElasticsearchConfigured() && (
                  <span className="mt-1 block text-xs text-muted-foreground/80">
                    Results use Elasticsearch when the index is populated.
                  </span>
                )}
              </>
            ) : (
              <>
                A curated mix of new listings, favoring active sellers, then freshest posts. Use the
                header search to look up listings.
                {showSeoBookmark && (
                  <span className="mt-1 block text-xs text-muted-foreground/80">
                    Bookmark this page —{" "}
                    <code className="rounded bg-muted px-1 py-0.5 text-[11px]">/search/recent</code>
                  </span>
                )}
              </>
            )}
          </p>
        </div>
      </section>

      <Suspense fallback={null}>
        <SearchCategoryFilters
          query={rawQuery}
          selectedSlug={selectedSlug}
          categories={sortedCategories}
          curated={curatedView}
          brandSlug={brandRow?.slug ?? (brandSlugRequested || null)}
          brandFilterName={brandRow?.name ?? null}
          brandUnknown={brandUnknown}
        />
      </Suspense>

      <section className="container mx-auto py-8">
        <RecentFeedClient
          listings={listings}
          favoritedListingIds={favoritedListingIds}
          isLoggedIn={!!user}
          viewerUserId={user?.id ?? null}
          emptyMessage={
            brandUnknown
              ? "No brand matches that URL. Return to search and pick a brand from suggestions."
              : brandRow
                ? "No active listings for this brand yet. Try another category or check back soon."
                : rawQuery
                  ? "No listings match your search. Try different keywords or filters."
                  : "No listings to show yet. Check back soon or browse by category."
          }
        />
      </section>
    </main>
  )
}

async function resolveSearchListings(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rawQuery: string,
  category: { id: string; name: string } | null,
  brand: { id: string; name: string } | null,
): Promise<{
  listings: RecentListing[]
  searchMeta: MarketplaceSearchResolutionMeta | null
}> {
  const categoryId = category?.id ?? null

  if (brand) {
    const listings = await listActiveListingsForBrand(supabase, brand, {
      limit: LIMIT,
      categoryId,
    })
    return { listings, searchMeta: null }
  }

  if (!rawQuery.trim()) {
    const r = await fetchCuratedRecentListings(supabase, categoryId, LIMIT)
    return { listings: r.listings, searchMeta: null }
  }

  if (isElasticsearchConfigured()) {
    try {
      const ids = await searchListingIdsFromElasticsearch(rawQuery, LIMIT, {
        categoryName: category?.name ?? null,
      })
      const listings = await hydrateListingsByIds(supabase, ids)
      return {
        listings,
        searchMeta: { resultCount: listings.length, backend: "elasticsearch" },
      }
    } catch (err) {
      console.error("[search] Elasticsearch error, falling back to Supabase:", err)
      const { listings } = await buildSearchFromSupabase(supabase, rawQuery, categoryId, LIMIT)
      return {
        listings,
        searchMeta: { resultCount: listings.length, backend: "supabase" },
      }
    }
  }

  const { listings } = await buildSearchFromSupabase(supabase, rawQuery, categoryId, LIMIT)
  return {
    listings,
    searchMeta: { resultCount: listings.length, backend: "supabase" },
  }
}

async function fetchCuratedRecentListings(
  supabase: Awaited<ReturnType<typeof createClient>>,
  categoryId: string | null,
  limit: number,
): Promise<{
  listings: RecentListing[]
}> {
  const pool = Math.min(120, Math.max(limit * 4, 48))
  let q = supabase
    .from("listings")
    .select(
      `
      id,
      slug,
      user_id,
      title,
      price,
      condition,
      section,
      city,
      state,
      shipping_available,
      board_type,
      dimensions,
      created_at,
      listing_images (url, is_primary),
      profiles!listings_user_id_fkey (display_name, avatar_url, location, sales_count, shop_verified),
      categories (name, slug)
    `,
    )
    .eq("status", "active")
    .eq("hidden_from_site", false)

  if (categoryId) {
    q = q.eq("category_id", categoryId)
  } else {
    q = q.eq("section", "surfboards")
  }

  q = q.order("created_at", { ascending: false }).limit(pool)
  const { data: rows, error } = await q

  if (error || !rows?.length) {
    const fallback = await buildSearchFromSupabase(supabase, "", categoryId, limit)
    return { listings: fallback.listings }
  }

  const sorted = [...rows].sort((a: any, b: any) => {
    const sa = a.profiles?.sales_count ?? 0
    const sb = b.profiles?.sales_count ?? 0
    if (sb !== sa) return sb - sa
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  return {
    listings: sorted.slice(0, limit).map((row) => rowToRecentListing(row)),
  }
}

async function buildSearchFromSupabase(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rawQuery: string,
  categoryId: string | null,
  limit: number,
): Promise<{
  listings: RecentListing[]
}> {
  const allRes = await buildSearchQuery(supabase, rawQuery, categoryId, limit)
  const rows = allRes.data ?? []
  const listings = rows.map((row: any) => rowToRecentListing(row))

  return {
    listings,
  }
}

function rowToRecentListing(row: any): RecentListing {
  const boardLength = boardLengthLabelFromDimensionsColumn(row.dimensions) ?? null
  return {
    id: row.id,
    slug: row.slug ?? null,
    user_id: row.user_id,
    title: row.title,
    price: row.price,
    condition: row.condition,
    section: row.section,
    city: row.city,
    state: row.state,
    shipping_available: row.shipping_available,
    board_type: row.board_type,
    board_length: boardLength,
    listing_images: row.listing_images,
    profiles: row.profiles,
    categories: row.categories,
  }
}

async function buildSearchQuery(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rawQuery: string,
  categoryId: string | null,
  limit: number,
): Promise<{ data: any[] }> {
  let query = supabase
    .from("listings")
    .select(
      `
      id,
      slug,
      user_id,
      title,
      price,
      condition,
      section,
      city,
      state,
      shipping_available,
      board_type,
      dimensions,
      listing_images (url, is_primary),
      profiles!listings_user_id_fkey (display_name, avatar_url, location, sales_count, shop_verified),
      categories (name, slug)
    `,
    )
    .eq("status", "active")
    .eq("hidden_from_site", false)

  if (categoryId) {
    query = query.eq("category_id", categoryId)
  } else {
    query = query.eq("section", "surfboards")
  }

  if (rawQuery) {
    const meaningful = meaningfulSearchTerms(rawQuery)
    if (meaningful.length > 0) {
      for (const term of meaningful) {
        const safe = term.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
        const pattern = `"%${safe}%"`
        query = query.or(
          `title.ilike.${pattern},description.ilike.${pattern},brand.ilike.${pattern},fins_setup.ilike.${pattern},tail_shape.ilike.${pattern}`,
        )
      }
    } else {
      const terms = (stripMarketplaceSearchNoiseWords(rawQuery) || rawQuery)
        .split(/\s+/)
        .map((t) => t.trim())
        .filter(Boolean)
      if (terms.length > 0) {
        const orParts: string[] = []
        for (const term of terms) {
          const safe = term.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
          const pattern = `"%${safe}%"`
          orParts.push(`title.ilike.${pattern}`)
          orParts.push(`description.ilike.${pattern}`)
          orParts.push(`brand.ilike.${pattern}`)
          orParts.push(`fins_setup.ilike.${pattern}`)
          orParts.push(`tail_shape.ilike.${pattern}`)
        }
        query = query.or(orParts.join(","))
      }
    }
  }

  query = query.order("created_at", { ascending: false }).limit(limit)
  const { data, error } = await query
  return { data: error ? [] : (data ?? []) }
}
