import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { SearchSectionFilters } from "./search-section-filters"
import type { RecentListing } from "@/app/used/recent/recent-feed-client"
import { RecentFeedClient } from "@/app/used/recent/recent-feed-client"
import { isElasticsearchConfigured } from "@/lib/elasticsearch/config"
import {
  meaningfulSearchTerms,
  searchListingIdsFromElasticsearch,
} from "@/lib/elasticsearch/listings-index"
import { hydrateListingsByIds } from "@/lib/search/hydrate-listings"

const LIMIT = 48

type Section = "all" | "used" | "boards"

export async function SearchPageView({
  rawQuery,
  sectionParam,
  showSeoBookmark,
}: {
  rawQuery: string
  sectionParam: Section
  /** Shown on the canonical recent-listings URL (`/search/recent`). */
  showSeoBookmark: boolean
}) {
  const curatedView = !rawQuery

  const supabase = await createClient()

  const [{ data: { user } }, { listings, usedCount, boardsCount }] =
    await Promise.all([
      supabase.auth.getUser(),
      resolveSearchListings(supabase, rawQuery, sectionParam),
    ])

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
                  A curated mix of new listings, favoring active sellers, then freshest posts. Use
                  the header search to look up gear and boards.
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
          <SearchSectionFilters
            query={rawQuery}
            section={sectionParam}
            usedCount={usedCount}
            boardsCount={boardsCount}
            curated={curatedView}
          />
        </Suspense>

        <section className="container mx-auto py-8">
          <RecentFeedClient
            listings={listings}
            favoritedListingIds={favoritedListingIds}
            isLoggedIn={!!user}
            emptyMessage={
              rawQuery
                ? "No listings match your search. Try different keywords or filters."
                : "No listings to show yet. Check back soon or browse Used Gear and Surfboards."
            }
          />
        </section>
      </main>
  )
}

async function resolveSearchListings(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rawQuery: string,
  section: Section,
): Promise<{
  listings: RecentListing[]
  usedCount: number
  boardsCount: number
}> {
  if (!rawQuery.trim()) {
    const r = await fetchCuratedRecentListings(supabase, section, LIMIT)
    return {
      listings: r.listings,
      usedCount: r.used,
      boardsCount: r.boards,
    }
  }

  let listings: RecentListing[] = []
  let usedCount = 0
  let boardsCount = 0

  if (isElasticsearchConfigured()) {
    try {
      const ids = await searchListingIdsFromElasticsearch(rawQuery, section, LIMIT)
      if (ids.length > 0) {
        listings = await hydrateListingsByIds(supabase, ids)
      }
      if (rawQuery.trim() && ids.length === 0) {
        listings = []
      }
      if (listings.length === 0) {
        const { listings: dbListings, used: u, boards: b } = await buildSearchFromSupabase(
          supabase,
          rawQuery,
          section,
          LIMIT,
        )
        listings = dbListings
        usedCount = u
        boardsCount = b
      } else {
        const { used: u, boards: b } = await getSectionCounts(supabase, rawQuery)
        usedCount = u
        boardsCount = b
      }
    } catch (err) {
      console.error("[search] Elasticsearch error, falling back to Supabase:", err)
      const result = await buildSearchFromSupabase(supabase, rawQuery, section, LIMIT)
      listings = result.listings
      usedCount = result.used
      boardsCount = result.boards
    }
  } else {
    const result = await buildSearchFromSupabase(supabase, rawQuery, section, LIMIT)
    listings = result.listings
    usedCount = result.used
    boardsCount = result.boards
  }

  return { listings, usedCount, boardsCount }
}

async function fetchCuratedRecentListings(
  supabase: Awaited<ReturnType<typeof createClient>>,
  section: Section,
  limit: number,
): Promise<{
  listings: RecentListing[]
  used: number
  boards: number
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

  if (section === "used") {
    q = q.eq("section", "used")
  } else if (section === "boards") {
    q = q.eq("section", "surfboards")
  } else {
    q = q.in("section", ["used", "surfboards"])
  }

  q = q.order("created_at", { ascending: false }).limit(pool)
  const { data: rows, error } = await q

  if (error || !rows?.length) {
    const fallback = await buildSearchFromSupabase(supabase, "", section, limit)
    return { listings: fallback.listings, used: fallback.used, boards: fallback.boards }
  }

  const sorted = [...rows].sort((a: any, b: any) => {
    const sa = a.profiles?.sales_count ?? 0
    const sb = b.profiles?.sales_count ?? 0
    if (sb !== sa) return sb - sa
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const [usedRes, boardsRes] = await Promise.all([
    buildSearchQuery(supabase, "", "used", 1),
    buildSearchQuery(supabase, "", "boards", 1),
  ])

  return {
    listings: sorted.slice(0, limit).map((row) => rowToRecentListing(row)),
    used: usedRes.count,
    boards: boardsRes.count,
  }
}

async function getSectionCounts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rawQuery: string,
): Promise<{ used: number; boards: number }> {
  const [usedRes, boardsRes] = await Promise.all([
    buildSearchQuery(supabase, rawQuery, "used", 1),
    buildSearchQuery(supabase, rawQuery, "boards", 1),
  ])
  return {
    used: usedRes.count,
    boards: boardsRes.count,
  }
}

async function buildSearchFromSupabase(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rawQuery: string,
  section: Section,
  limit: number,
): Promise<{
  listings: RecentListing[]
  used: number
  boards: number
}> {
  const [allRes, usedRes, boardsRes] = await Promise.all([
    buildSearchQuery(supabase, rawQuery, section, limit),
    buildSearchQuery(supabase, rawQuery, "used", limit),
    buildSearchQuery(supabase, rawQuery, "boards", limit),
  ])

  const rows = allRes.data ?? []
  const listings = rows.map((row: any) => rowToRecentListing(row))

  return {
    listings,
    used: usedRes.count,
    boards: boardsRes.count,
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
  supabase: any,
  rawQuery: string,
  section: Section,
  limit: number,
): Promise<{ data: any[]; count: number }> {
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
      { count: "exact" },
    )
    .eq("status", "active")

  if (section === "used") {
    query = query.eq("section", "used")
  } else if (section === "boards") {
    query = query.eq("section", "surfboards")
  } else {
    query = query.in("section", ["used", "surfboards"])
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
  const { data, count, error } = await query
  return { data: data ?? [], count: error ? 0 : (count ?? 0) }
}
