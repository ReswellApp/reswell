import { getCachedDashboardSession } from "@/lib/dashboard-session"
import { fetchMyListings } from "@/lib/db/my-listings"
import { MyListingsClient } from "@/components/features/dashboard/my-listings-client"

export default async function MyListingsPage() {
  const { supabase, user } = await getCachedDashboardSession()
  if (!user) return null

  const { listings, stats, error } = await fetchMyListings(supabase, user.id)

  if (error) {
    console.error("[dashboard/listings] fetch failed", {
      userId: user.id,
      message: error,
      timestamp: new Date().toISOString(),
    })
  }

  return <MyListingsClient listings={listings} stats={stats} fetchError={error} />
}
