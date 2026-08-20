import { SavedListContent } from "@/components/saved-list-content"
import { getCachedRequestSession } from "@/lib/auth/cached-request-session"
import { getSavedFavoritesForUser } from "@/lib/db/favorites"
import { pageSeoMetadata } from "@/lib/site-metadata"

export const metadata = pageSeoMetadata({
  title: "Saved listings — Reswell",
  description: "Your saved surfboard listings on Reswell.",
  path: "/favorites",
  robots: { index: false, follow: false },
})

export default async function FavoritesPage() {
  const { supabase, user } = await getCachedRequestSession()

  if (!user) {
    return null
  }

  const { favorites } = await getSavedFavoritesForUser(supabase, user.id)

  return (
    <main className="flex-1">
      <section className="container mx-auto py-8">
        <SavedListContent viewerId={user.id} initialFavorites={favorites} />
      </section>
    </main>
  )
}
