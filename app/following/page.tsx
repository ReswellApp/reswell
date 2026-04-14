import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { FollowingFeedClient } from "./following-feed-client"
import { pageSeoMetadata } from "@/lib/site-metadata"

export const metadata = pageSeoMetadata({
  title: "Following feed — Reswell",
  description: "New listings and updates from sellers you follow on Reswell.",
  path: "/following",
  robots: { index: false, follow: false },
})

export default async function FollowingFeedPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login?redirect=/following")
  }

  // How many sellers the user follows
  const { count: followCount } = await supabase
    .from("seller_follows")
    .select("id", { count: "exact", head: true })
    .eq("follower_id", user.id)

  // Get seller IDs the user follows
  const { data: followedSellers } = await supabase
    .from("seller_follows")
    .select("seller_id")
    .eq("follower_id", user.id)

  const sellerIds = (followedSellers ?? []).map((f) => f.seller_id)

  // Initial page of feed listings (30 days, cursor-based)
  const { data: feedListings } = sellerIds.length
    ? await supabase
        .from("listings")
        .select(`
          id,
          title,
          price,
          slug,
          section,
          created_at,
          city,
          state,
          listing_images (url, is_primary),
          seller:profiles!listings_user_id_fkey (
            id,
            seller_slug,
            display_name,
            shop_name,
            avatar_url,
            city
          )
        `)
        .in("user_id", sellerIds)
        .eq("status", "active")
        .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order("created_at", { ascending: false })
        .limit(20)
    : { data: [] }

  // Suggested sellers (top active sellers near the user's location) for empty state
  const { data: profile } = await supabase
    .from("profiles")
    .select("city")
    .eq("id", user.id)
    .single()

  const { data: suggestedSellers } = await supabase
    .from("profiles")
    .select(`
      id,
      seller_slug,
      display_name,
      shop_name,
      avatar_url,
      shop_logo_url,
      city,
      follower_count
    `)
    .neq("id", user.id)
    .order("follower_count", { ascending: false })
    .limit(6)

  return (
    <FollowingFeedClient
      userId={user.id}
      initialListings={(feedListings ?? []) as any[]}
      followCount={followCount ?? 0}
      userCity={profile?.city || null}
      suggestedSellers={(suggestedSellers ?? []) as any[]}
    />
  )
}
