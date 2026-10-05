import { getCachedDashboardSession } from "@/lib/dashboard-session"
import { fetchListingsDeskProfile } from "@/lib/db/shopCategoryPackageSizes"
import { fetchMyListings } from "@/lib/db/my-listings"
import { fetchSellerBanState, isSellerBanActive } from "@/lib/db/sellerBan"
import { sellerProfileHref } from "@/lib/seller-slug"
import { MyListingsClient } from "@/components/features/dashboard/my-listings-client"

function parseListingsStatus(
  value: string | undefined,
): "all" | "draft" | "active" | "vacation" | "sold" {
  if (value === "draft" || value === "active" || value === "vacation" || value === "sold") {
    return value
  }
  return "all"
}

function parseListingsView(value: string | undefined): "basic" | "advanced" {
  return value === "advanced" ? "advanced" : "basic"
}

export default async function MyListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; view?: string }>
}) {
  const { supabase, user } = await getCachedDashboardSession()
  if (!user) return null

  const [{ listings, stats, error }, banState, params, deskProfile] = await Promise.all([
    fetchMyListings(supabase, user.id),
    fetchSellerBanState(supabase, user.id),
    searchParams,
    fetchListingsDeskProfile(supabase, user.id),
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
      initialView={parseListingsView(params.view)}
      sellerStoreHref={
        deskProfile.sellerSlug ? sellerProfileHref({ seller_slug: deskProfile.sellerSlug }) : null
      }
      shopCategoryPackageSizes={deskProfile.shopCategoryPackageSizes}
    />
  )
}
