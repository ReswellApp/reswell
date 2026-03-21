import { Suspense } from "react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { createClient } from "@/lib/supabase/server"
import { SearchForm } from "./search-form"
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

/** Search uses cookies (auth) + query string; must not be statically prerendered. */
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

  const [{ data: { user } }, listings] = await Promise.all([
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
          <div className="container mx-auto px-4 py-8 max-w-3xl">
            <h1 className="text-2xl font-bold mb-2">Search</h1>
            <p className="text-muted-foreground mb-6">
              Search used gear and surfboards by title, description, category, brand, and location.
              {isElasticsearchConfigured() && (
                <span className="block text-xs mt-1 text-muted-foreground/80">
                  Powered by Elasticsearch when the index has data; otherwise results fall back to the database.
                </span>
              )}
            </p>
            <Suspense
              fallback={
                <div className="flex gap-3">
                  <div className="h-12 flex-1 animate-pulse rounded-xl bg-muted" />
                  <div className="h-12 w-24 shrink-0 animate-pulse rounded-xl bg-muted" />
                </div>
              }
            >
              <SearchForm initialQuery={rawQuery} section="" />
            </Suspense>
          </div>
        </section>

        <section className="container mx-auto px-4 py-8">
          <RecentFeedClient
            listings={listings}
            favoritedListingIds={favoritedListingIds}
            isLoggedIn={!!user}
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
): Promise<RecentListing[]> {
  if (isElasticsearchConfigured()) {
    try {
      const ids = await searchListingIdsFromElasticsearch(rawQuery, section, LIMIT)
      if (ids.length > 0) {
        return hydrateListingsByIds(supabase, ids)
      }
      // Empty ES hits (index empty / not reindexed / no matches): use Supabase so search still works
    } catch (err) {
      console.error("[search] Elasticsearch error, falling back to Supabase:", err)
    }
  }

  const data = await buildSearchQuery(supabase, rawQuery, section)
  return (
    (data ?? []).map((row: any) => {
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
      } satisfies RecentListing
    }) ?? []
  )
}

async function buildSearchQuery(
  supabase: any,
  rawQuery: string,
  section: "all" | "used" | "boards",
) {
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

  query = query.order("created_at", { ascending: false }).limit(LIMIT)

  const { data } = await query
  return data
}
