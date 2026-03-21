import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { createClient } from "@/lib/supabase/server"
import { RecentFeedClient, type RecentListing } from "./recent-feed-client"

const LIMIT = 50

export default async function RecentUsedPage() {
  const supabase = await createClient()

  const [{ data: { user } }, usedRes, boardsRes] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("listings")
      .select(`
        id,
        slug,
        user_id,
        title,
        price,
        condition,
        section,
        created_at,
        city,
        state,
        shipping_available,
        listing_images (url, is_primary),
        profiles (display_name, avatar_url, location, sales_count),
        categories (name, slug)
      `)
      .eq("status", "active")
      .eq("section", "used")
      .order("created_at", { ascending: false })
      .limit(LIMIT),
    supabase
      .from("listings")
      .select(`
        id,
        slug,
        user_id,
        title,
        price,
        condition,
        section,
        created_at,
        city,
        state,
        shipping_available,
        board_type,
        length_feet,
        length_inches,
        listing_images (url, is_primary),
        profiles (display_name, avatar_url, location, sales_count),
        categories (name, slug)
      `)
      .eq("status", "active")
      .eq("section", "surfboards")
      .order("created_at", { ascending: false })
      .limit(LIMIT),
  ])

  let favoritedListingIds: string[] = []
  if (user) {
    const { data: favs } = await supabase
      .from("favorites")
      .select("listing_id")
      .eq("user_id", user.id)
    favoritedListingIds = (favs ?? []).map((f) => f.listing_id)
  }

  const withCreated = (res: any[], section: string) =>
    (res ?? []).map((row: any) => {
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
        section: row.section ?? section,
        created_at: row.created_at,
        city: row.city,
        state: row.state,
        shipping_available: row.shipping_available,
        board_type: row.board_type,
        board_length: boardLength,
        listing_images: row.listing_images,
        profiles: row.profiles,
        categories: row.categories,
      }
    })
  const merged = [
    ...withCreated(usedRes.data ?? [], "used"),
    ...withCreated(boardsRes.data ?? [], "surfboards"),
  ]
  const feedListings: RecentListing[] = merged
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, LIMIT)
    .map(({ created_at: _c, ...rest }) => rest as RecentListing)

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        {/* Feed header - reference style, site theme */}
        <section className="border-b border-border bg-background">
          <div className="container mx-auto px-4 py-8">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              New listings feed
            </h1>
            <p className="mt-1 text-muted-foreground">
              Latest used gear and surfboards on the marketplace
            </p>
          </div>
        </section>

        <section className="container mx-auto px-4 py-6">
          <RecentFeedClient
            listings={feedListings}
            favoritedListingIds={favoritedListingIds}
            isLoggedIn={!!user}
          />
        </section>
      </main>

      <Footer />
    </div>
  )
}
