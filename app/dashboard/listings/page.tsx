import { getCachedDashboardSession } from "@/lib/dashboard-session"
import { fetchMyListings } from "@/lib/db/my-listings"
import { fetchSellerBanState, isSellerBanActive } from "@/lib/db/sellerBan"
import { MyListingsClient } from "@/components/features/dashboard/my-listings-client"

function parseListingsStatus(
  value: string | undefined,
): "all" | "draft" | "active" | "sold" {
  if (value === "draft" || value === "active" || value === "sold") return value
  return "all"
}

export default async function MyListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { supabase, user } = await getCachedDashboardSession()
  if (!user) return null

  const [{ listings, stats, error }, banState, params] = await Promise.all([
    fetchMyListings(supabase, user.id),
    fetchSellerBanState(supabase, user.id),
    searchParams,
  ])

  if (error) {
    console.error("[dashboard/listings] fetch failed", {
      userId: user.id,
      message: error,
      timestamp: new Date().toISOString(),
    })
  }

  return (
    <MyListingsClient
      listings={listings}
      stats={stats}
      sellerUserId={user.id}
      fetchError={error}
      sellerBanned={isSellerBanActive(banState)}
      initialStatusFilter={parseListingsStatus(params.status)}
    />
  )
}
