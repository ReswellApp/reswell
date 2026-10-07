import { after } from "next/server"
import { privatePageMetadata } from "@/lib/site-metadata"
import { getCachedDashboardSession } from "@/lib/dashboard-session"
import { DashboardOverview } from "@/components/features/dashboard/dashboard-overview"
import type { DashboardOverviewListingPreview } from "@/components/features/dashboard/dashboard-overview-model"
import { reconcileWalletAggregates } from "@/lib/wallet-reconcile"
import { persistWalletAggregatesIfNeeded } from "@/lib/services/walletReconcile"
import { proxiedListingImageSrc } from "@/lib/listing-media-proxy-url"
import { profileMediaDisplaySrc } from "@/lib/public-media-display-src"
import { ORDER_STATUS_LIST } from "@/lib/order-status"
import { sellerProfileHref } from "@/lib/seller-slug"
import { getMySellerEarningsTotals } from "@/lib/db/sellerEarningsTotals"
import { REAL_MARKETPLACE_SALES_FILTER } from "@/lib/order-admin-test"
import { peerListingEditHref } from "@/lib/peer-listing-sections"

export const metadata = privatePageMetadata({
  title: "Dashboard — Reswell",
  description:
    "Your Reswell home: listings, purchases, wallet, offers, and messages — manage your surf marketplace activity.",
  path: "/dashboard",
})

export default async function DashboardPage() {
  const { supabase, user } = await getCachedDashboardSession()

  if (!user) return null

  const orderStatuses = [...ORDER_STATUS_LIST]
  const [
    listingsAgg,
    favoritesAgg,
    unreadNotifAgg,
    publishedListingsRes,
    draftListingsRes,
    pendingOffersReceivedRes,
    walletRes,
    profileRes,
    newFollowersRes,
    buyerOrdersRes,
    sellerOrdersRes,
    followingRes,
    sellerEarningsTotalsRes,
  ] = await Promise.all([
    supabase
      .from("listings")
      .select("id, status", { count: "exact" })
      .eq("user_id", user.id),
    supabase
      .from("favorites")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false),
    supabase
      .from("listings")
      .select("id, title, price, status, section, listing_images (url, is_primary)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .is("archived_at", null)
      .order("updated_at", { ascending: false })
      .limit(4),
    supabase
      .from("listings")
      .select("id, title, price, status, section, listing_images (url, is_primary)")
      .eq("user_id", user.id)
      .eq("status", "draft")
      .order("updated_at", { ascending: false })
      .limit(4),
    supabase
      .from("offers")
      .select("id", { count: "exact", head: true })
      .eq("seller_id", user.id)
      .eq("status", "PENDING"),
    supabase
      .from("wallets")
      .select("id, balance, pending_balance, lifetime_earned, lifetime_spent, lifetime_cashed_out")
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("profiles")
      .select(
        "is_shop, is_admin, shop_name, display_name, city, location, seller_slug, avatar_url, shop_logo_url, follower_count, unread_message_count, unread_support_count",
      )
      .eq("id", user.id)
      .single(),
    supabase
      .from("seller_follows")
      .select("id", { count: "exact", head: true })
      .eq("seller_id", user.id)
      .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("buyer_id", user.id)
      .in("status", orderStatuses),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("seller_id", user.id)
      .match(REAL_MARKETPLACE_SALES_FILTER)
      .in("status", orderStatuses),
    supabase
      .from("seller_follows")
      .select("id", { count: "exact", head: true })
      .eq("follower_id", user.id),
    getMySellerEarningsTotals(supabase),
  ])

  const listings = listingsAgg.data
  const listingCount = listingsAgg.count
  const activeListings = listings?.filter((listing) => listing.status === "active").length || 0
  const favoriteCount = favoritesAgg.count
  const unreadNotifCount = unreadNotifAgg.count
  const pendingOffersReceived = pendingOffersReceivedRes.count ?? 0
  const walletRow = walletRes.data
  const profile = profileRes.data
  const unreadMsgCount = profile?.unread_message_count ?? 0
  const unreadSupportCount = Number(profile?.unread_support_count ?? 0)
  const unreadCount = Number(unreadMsgCount ?? 0) + (unreadNotifCount ?? 0)
  const followerCount = profile?.follower_count ?? 0
  const newFollowersThisMonth = newFollowersRes.count ?? 0
  const buyerOrderCount = buyerOrdersRes.count ?? 0
  const sellerOrderCount = sellerOrdersRes.count ?? 0
  const followingCount = followingRes.count ?? 0
  const sellerEarningsTotals = sellerEarningsTotalsRes

  const metadataName = textOrNull(user.user_metadata?.full_name)
  const name =
    (profile?.is_shop ? textOrNull(profile?.shop_name) : null) ??
    textOrNull(profile?.display_name) ??
    metadataName ??
    "User"

  const location = uniqueJoined([textOrNull(profile?.city), textOrNull(profile?.location)])
  const shopSlug = textOrNull(profile?.seller_slug)
  const shopHref = profile?.is_shop && shopSlug ? sellerProfileHref(profile) : null
  const rawImage = profile?.is_shop
    ? textOrNull(profile?.shop_logo_url) ?? textOrNull(profile?.avatar_url)
    : textOrNull(profile?.avatar_url)
  const profileImageUrl = rawImage ? profileMediaDisplaySrc(rawImage) || null : null

  let walletBalance = 0
  let lifetimeEarned = 0
  if (walletRow) {
    const reconciled = reconcileWalletAggregates(walletRow)
    walletBalance = reconciled.totalBalance
    const earnedRaw = walletRow.lifetime_earned
    const earnedParsed =
      earnedRaw === null || earnedRaw === undefined
        ? 0
        : typeof earnedRaw === "number"
          ? earnedRaw
          : parseFloat(String(earnedRaw))
    lifetimeEarned = Number.isFinite(earnedParsed) ? earnedParsed : 0
    if (reconciled.needsPersist) {
      after(async () => {
        try {
          await persistWalletAggregatesIfNeeded(supabase, walletRow)
        } catch (error) {
          console.error("[DashboardPage] wallet reconcile persist failed:", error)
        }
      })
    }
  }

  if (sellerEarningsTotals !== null) {
    lifetimeEarned = sellerEarningsTotals.lifetimeSoldUsd
  }

  return (
    <DashboardOverview
      model={{
        name,
        location,
        profileImageUrl,
        shopHref,
        walletBalance,
        lifetimeEarned,
        activeListings,
        listingCount: listingCount || 0,
        sellerOrderCount,
        buyerOrderCount,
        pendingOffers: pendingOffersReceived,
        unreadCount,
        unreadSupportCount,
        favoriteCount: favoriteCount || 0,
        followerCount,
        followingCount,
        newFollowersThisMonth,
        isAdmin: profile?.is_admin === true,
        activeListingPreviews: toPreviews(publishedListingsRes.data),
        draftListingPreviews: toPreviews(draftListingsRes.data),
      }}
    />
  )
}

function textOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function uniqueJoined(parts: Array<string | null>): string | null {
  const unique = [...new Set(parts.filter((part): part is string => part !== null))]
  return unique.length > 0 ? unique.join(" · ") : null
}

function toPreviews(rows: unknown): DashboardOverviewListingPreview[] {
  if (!Array.isArray(rows)) return []
  const previews: DashboardOverviewListingPreview[] = []
  for (const row of rows) {
    const preview = toPreview(row)
    if (preview) previews.push(preview)
  }
  return previews
}

function toPreview(row: unknown): DashboardOverviewListingPreview | null {
  if (!row || typeof row !== "object") return null
  const listing = row as Record<string, unknown>
  if (typeof listing.id !== "string" || typeof listing.title !== "string") return null

  const price = typeof listing.price === "number" ? listing.price : Number(listing.price)
  const section = typeof listing.section === "string" ? listing.section : null
  const proxied = primaryImageUrl(listing.listing_images)

  return {
    id: listing.id,
    title: listing.title,
    price: Number.isFinite(price) ? price : 0,
    section,
    imageSrc: proxied,
    href: peerListingEditHref(section, listing.id),
  }
}

function primaryImageUrl(images: unknown): string | null {
  if (!Array.isArray(images)) return null
  let fallback: string | null = null
  for (const image of images) {
    if (!image || typeof image !== "object") continue
    const candidate = image as { url?: unknown; is_primary?: unknown }
    if (typeof candidate.url !== "string" || candidate.url.length === 0) continue
    if (candidate.is_primary === true) {
      return proxiedListingImageSrc(candidate.url) || null
    }
    if (!fallback) fallback = candidate.url
  }
  return fallback ? proxiedListingImageSrc(fallback) || null : null
}
