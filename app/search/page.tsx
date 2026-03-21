import { Suspense } from "react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { createClient } from "@/lib/supabase/server"
import { SearchSectionFilters } from "./search-section-filters"
import type { RecentListing } from "@/app/used/recent/recent-feed-client"
import { RecentFeedClient } from "@/app/used/recent/recent-feed-client"
import { isElasticsearchConfigured } from "@/lib/elasticsearch/config"
import { searchListingIdsFromElasticsearch } from "@/lib/elasticsearch/listings-index"
import { hydrateListingsByIds } from "@/lib/search/hydrate-listings"

interface SearchParams {
  q?: string
  section?: string
}

const LIMIT = 48

/** Search uses query params + auth; must not be statically prerendered. */
export const dynamic = "force-dynamic"

export default async function SearchPage(props: {
  searchParams: Promise<SearchParams>
}) {
  const searchParams = await props.searchParams
  const rawQuery = (searchParams.q ?? "").trim()
  const sectionParam = (searchParams.section ?? "all") as
    | "all"
    | "used"
    | "boards"

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
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <section className="border-b bg-background">
          <div className="container mx-auto px-4 py-6 md:py-8">
            <h1 className="text-xl font-bold text-foreground md:text-2xl">
              {rawQuery ? (
                <>Results for &ldquo;{rawQuery}&rdquo;</>
              ) : (
                <>Marketplace search</>
              )}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Use the search bar in the header to find gear and boards.
              {isElasticsearchConfigured() && (
                <span className="mt-1 block text-xs text-muted-foreground/80">
                  Results use Elasticsearch when the index is populated.
                </span>
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
          />
        </Suspense>

        <section className="container mx-auto px-4 py-8">
          <RecentFeedClient
            listings={listings}
            favoritedListingIds={favoritedListingIds}
            isLoggedIn={!!user}
            emptyMessage={
              rawQuery
                ? "No listings match your search. Try different keywords or filters."
                : "No active listings to show. Use the header search or browse Used Gear and Surfboards."
            }
          />
        </section>
      </main>
      <Footer />
    </div>
  )
}

async function resolveSearchListings(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rawQuery: string,
  section: "all" | "used" | "boards",
): Promise<{
  listings: RecentListing[]
  usedCount: number
  boardsCount: number
}> {
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
      // When ES returns nothing or empty index, fall through to Supabase
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
  section: "all" | "used" | "boards",
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
  section: "all" | "used" | "boards",
  limit: number,
): Promise<{ data: any[]; count: number }> {
  let query = supabase
    .from("listings")
    .select(
      `
      id,
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
      profiles (display_name, avatar_url, location, sales_count),
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
      }
      query = query.or(orParts.join(","))
    }
  }

  query = query.order("created_at", { ascending: false }).limit(limit)
  const { data, count, error } = await query
  return { data: data ?? [], count: error ? 0 : (count ?? 0) }
}
