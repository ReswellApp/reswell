import { redirect } from "next/navigation"
import { SavedListContent } from "@/components/saved-list-content"
import { DashboardPageHeader } from "@/components/features/dashboard/dashboard-page-header"
import { getCachedDashboardSession } from "@/lib/dashboard-session"
import { getSavedFavoritesForUser } from "@/lib/db/favorites"
import { privatePageMetadata } from "@/lib/site-metadata"

export const metadata = privatePageMetadata({
  title: "Favorites — Reswell",
  description: "Your saved surfboard listings on Reswell.",
  path: "/dashboard/favorites",
})

export default async function DashboardFavoritesPage() {
  const { supabase, user } = await getCachedDashboardSession()
  if (!user) {
    redirect("/auth/login?redirect=/dashboard/favorites")
  }

  const { favorites } = await getSavedFavoritesForUser(supabase, user.id)

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Favorites"
        description="Your collection of favorite gear and boards."
      />
      <SavedListContent viewerId={user.id} initialFavorites={favorites} />
    </div>
  )
}
