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
import { hydrateListingsByIds } from "@/lib/search/hydrate-listings"

const LIMIT = 48

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
  categorySlugFromUrl,
  showSeoBookmark,
}: {
  rawQuery: string
  /** Raw `?category=` segment; must match `categories.slug` to apply. */
  categorySlugFromUrl: string
  /** Shown on the canonical recent-listings URL (`/search/recent`). */
  showSeoBookmark: boolean
}) {
  const curatedView = !rawQuery

  const supabase = await createClient()

  const [{ data: { user } }, { data: categoryRows }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("categories").select("id, name, slug, board").eq("board", true),
  ])

  const sortedCategories = sortMarketplaceBrowseCategories(categoryRows ?? [])
  const requestedSlug = categorySlugFromUrl.trim()
  const matched = requestedSlug
    ? sortedCategories.find((c) => c.slug === requestedSlug)
    : undefined
  const categoryId = matched?.id ?? null
  const selectedSlug = matched?.slug ?? null

  const { listings } = await resolveSearchListings(supabase, rawQuery, categoryId)

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
            {rawQuery ? (
              <>Results for &ldquo;{rawQuery}&rdquo;</>
            ) : (
              <>Recently listed for you</>
            )}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {rawQuery ? (
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
        />
      </Suspense>

      <section className="container mx-auto py-8">
        <RecentFeedClient
          listings={listings}
          favoritedListingIds={favoritedListingIds}
          isLoggedIn={!!user}
          viewerUserId={user?.id ?? null}
          emptyMessage={
            rawQuery
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
  categoryId: string | null,
): Promise<{
  listings: RecentListing[]
}> {
  if (!rawQuery.trim()) {
    const r = await fetchCuratedRecentListings(supabase, categoryId, LIMIT)
    return { listings: r.listings }
  }

  if (categoryId) {
    const { listings } = await buildSearchFromSupabase(supabase, rawQuery, categoryId, LIMIT)
    return { listings }
  }

  if (isElasticsearchConfigured()) {
    try {
      const ids = await searchListingIdsFromElasticsearch(rawQuery, LIMIT)
      if (ids.length > 0) {
        const listings = await hydrateListingsByIds(supabase, ids)
        return { listings }
      }
    } catch (err) {
      console.error("[search] Elasticsearch error, falling back to Supabase:", err)
      const { listings } = await buildSearchFromSupabase(supabase, rawQuery, null, LIMIT)
      return { listings }
    }
  }

  const { listings } = await buildSearchFromSupabase(supabase, rawQuery, null, LIMIT)
  return { listings }
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
      length_feet,
      length_inches,
      created_at,
      listing_images (url, is_primary),
      profiles (display_name, avatar_url, location, sales_count, shop_verified),
      categories (name, slug)
    `,
    )
    .eq("status", "active")

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
  const boardLength =
    row.length_feet != null && row.length_inches != null
      ? `${row.length_feet}'${row.length_inches}"`
      : row.length_feet != null
        ? `${row.length_feet}'`
        : null
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
      length_feet,
      length_inches,
      listing_images (url, is_primary),
      profiles (display_name, avatar_url, location, sales_count, shop_verified),
      categories (name, slug)
    `,
    )
    .eq("status", "active")

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
          `title.ilike.${pattern},description.ilike.${pattern},brand.ilike.${pattern}`,
        )
      }
    } else {
      const terms = rawQuery
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
        }
        query = query.or(orParts.join(","))
      }
    }
  }

  query = query.order("created_at", { ascending: false }).limit(limit)
  const { data, error } = await query
  return { data: error ? [] : (data ?? []) }
}
