import { SavedListContent } from "@/components/saved-list-content"
import { getCachedRequestSession } from "@/lib/auth/cached-request-session"
import { getSavedFavoritesForUser } from "@/lib/db/favorites"
import { privatePageMetadata } from "@/lib/site-metadata"
import {
  dashboardPageSubtitleClass,
  dashboardPageTitleClass,
} from "@/lib/utils/dashboard-display-styles"

export const metadata = privatePageMetadata({
  title: "Favorites — Reswell",
  description: "Your saved surfboard listings on Reswell.",
  path: "/favorites",
})

export default async function FavoritesPage() {
  const { supabase, user } = await getCachedRequestSession()
  // Guests are covered by the sign-in gate in the layout. Skip the query so
  // the gate can render without a saved-list fetch.
  if (!user) return null

  const { favorites } = await getSavedFavoritesForUser(supabase, user.id)

  return (
    <main className="flex-1">
      <section className="container mx-auto space-y-6 py-8">
        <header>
          <h1 className={dashboardPageTitleClass}>Favorites</h1>
          <p className={dashboardPageSubtitleClass}>Your collection of favorite gear and boards.</p>
        </header>
        <SavedListContent viewerId={user.id} initialFavorites={favorites} />
      </section>
    </main>
  )
}
