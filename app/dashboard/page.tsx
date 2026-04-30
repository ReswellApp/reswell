import Link from "next/link"
import Image from "next/image"
import { privatePageMetadata } from "@/lib/site-metadata"
import { getCachedDashboardSession } from "@/lib/dashboard-session"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Package,
  Heart,
  MessageSquare,
  ArrowRight,
  Wallet,
  Users,
  Lightbulb,
  Handshake,
  ShoppingBag,
  PackageCheck,
  UserCircle,
  List,
  Plus,
  TrendingUp,
} from "lucide-react"
import { capitalizeWords } from "@/lib/listing-labels"
import { reconcileWalletAggregates, walletAggregateStrings } from "@/lib/wallet-reconcile"
import { proxiedListingImageSrc } from "@/lib/listing-media-proxy-url"
import { ORDER_STATUS_LIST } from "@/lib/order-status"
import { sellerProfileHref } from "@/lib/seller-slug"
import { DashboardOverviewRealtimeRefresh } from "@/components/features/dashboard/dashboard-overview-realtime-refresh"

export const metadata = privatePageMetadata({
  title: "Dashboard — Reswell",
  description:
    "Your Reswell home: listings, orders, wallet, offers, and messages — manage your surf marketplace activity.",
  path: "/dashboard",
})

export default async function DashboardPage() {
  const { supabase, user } = await getCachedDashboardSession()

  if (!user) return null

  const orderStatuses = [...ORDER_STATUS_LIST]
  const [
    listingsAgg,
    favoritesAgg,
    unreadMsgRes,
    unreadNotifAgg,
    publishedListingsRes,
    draftListingsRes,
    pendingOffersReceivedRes,
    walletRes,
    profileRes,
    followersRes,
    newFollowersRes,
    buyerOrdersRes,
    sellerOrdersRes,
    followingRes,
  ] = await Promise.all([
    supabase
      .from("listings")
      .select("*", { count: "exact" })
      .eq("user_id", user.id),
    supabase
      .from("favorites")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase.rpc("get_unread_message_count", { uid: user.id }),
    supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false),
    supabase
      .from("listings")
      .select("*, listing_images (url, is_primary)")
      .eq("user_id", user.id)
      .in("status", ["active", "sold"])
      .is("archived_at", null)
      .order("updated_at", { ascending: false })
      .limit(4),
    supabase
      .from("listings")
      .select("*, listing_images (url, is_primary)")
      .eq("user_id", user.id)
      .eq("status", "draft")
      .order("updated_at", { ascending: false })
      .limit(4),
    supabase
      .from("offers")
      .select("*", { count: "exact", head: true })
      .eq("seller_id", user.id)
      .eq("status", "PENDING"),
    supabase
      .from("wallets")
      .select("id, balance, pending_balance, lifetime_earned, lifetime_spent, lifetime_cashed_out")
      .eq("user_id", user.id)
      .single(),
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("profiles").select("follower_count").eq("id", user.id).single(),
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
      .in("status", orderStatuses),
    supabase
      .from("seller_follows")
      .select("id", { count: "exact", head: true })
      .eq("follower_id", user.id),
  ])

  const listings = listingsAgg.data
  const listingCount = listingsAgg.count
  const activeListings = listings?.filter((l) => l.status === "active").length || 0
  const favoriteCount = favoritesAgg.count
  const unreadMsgCount = unreadMsgRes.data
  const unreadNotifCount = unreadNotifAgg.count
  const unreadCount = Number(unreadMsgCount ?? 0) + (unreadNotifCount ?? 0)
  const publishedListings = publishedListingsRes.data
  const draftListings = draftListingsRes.data
  const pendingOffersReceived = pendingOffersReceivedRes.count ?? 0
  const walletRow = walletRes.data
  const profile = profileRes.data
  const followerCount = followersRes.data?.follower_count ?? 0
  const newFollowersThisMonth = newFollowersRes.count ?? 0
  const buyerOrderCount = buyerOrdersRes.count ?? 0
  const sellerOrderCount = sellerOrdersRes.count ?? 0
  const followingCount = followingRes.count ?? 0

  const welcomeName =
    (profile?.is_shop && profile?.shop_name?.trim()) ||
    profile?.display_name?.trim() ||
    (user.user_metadata?.full_name as string | undefined)?.trim() ||
    "User"

  const profileTitle =
    (profile?.is_shop && profile?.shop_name?.trim()) || profile?.display_name?.trim() || welcomeName
  const profileImageUrl = profile?.is_shop
    ? profile?.shop_logo_url || profile?.avatar_url
    : profile?.avatar_url

  let walletBalance = 0
  let allTimeEarned = 0
  if (walletRow) {
    const r = reconcileWalletAggregates(walletRow)
    walletBalance = r.totalBalance
    const earnedRaw = walletRow.lifetime_earned
    const earnedParsed =
      earnedRaw === null || earnedRaw === undefined
        ? 0
        : typeof earnedRaw === "number"
          ? earnedRaw
          : parseFloat(String(earnedRaw))
    allTimeEarned = Number.isFinite(earnedParsed) ? earnedParsed : 0
    if (r.needsPersist) {
      const s = walletAggregateStrings(r)
      await supabase
        .from("wallets")
        .update({
          balance: s.balance,
          pending_balance: s.pending_balance,
          lifetime_cashed_out: s.lifetime_cashed_out,
          updated_at: new Date().toISOString(),
        })
        .eq("id", walletRow.id)
    }
  }

  const coreStats: Array<{
    name: string
    value: string | number
    total?: number
    icon: typeof Wallet
    href: string
    highlight?: boolean
  }> = [
    {
      name: "Earnings",
      value: `$${walletBalance.toFixed(2)}`,
      icon: Wallet,
      href: "/dashboard/earnings",
      highlight: true,
    },
    {
      name: "Sales",
      value: sellerOrderCount,
      icon: PackageCheck,
      href: "/dashboard/sales",
    },
    {
      name: "Orders",
      value: buyerOrderCount,
      icon: ShoppingBag,
      href: "/dashboard/orders",
    },
    {
      name: "My listings",
      value: activeListings,
      total: listingCount || 0,
      icon: Package,
      href: "/dashboard/listings",
    },
  ]

  const activityStats: Array<{
    name: string
    value: number
    icon: typeof Heart
    href: string
  }> = [
    {
      name: "Pending offers",
      value: pendingOffersReceived,
      icon: Handshake,
      href: "/dashboard/offers?tab=received",
    },
    {
      name: "Favorites",
      value: favoriteCount || 0,
      icon: Heart,
      href: "/favorites",
    },
    {
      name: "Unread",
      value: unreadCount || 0,
      icon: MessageSquare,
      href: "/messages",
    },
  ]

  return (
    <div className="space-y-6 md:space-y-8">
      <DashboardOverviewRealtimeRefresh />

      {/* Welcome */}
      <div className="max-w-3xl">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Welcome back, {welcomeName}</h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          Here is what is happening with your account — updates in real time.
        </p>
      </div>

      {/* Profile */}
      <Card className="overflow-hidden">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-muted">
                {profileImageUrl ? (
                  <Image
                    src={profileImageUrl}
                    alt=""
                    width={64}
                    height={64}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground" aria-hidden>
                    <UserCircle className="h-9 w-9" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-muted-foreground">Profile</p>
                <h2 className="truncate text-lg font-semibold tracking-tight sm:text-xl">{profileTitle}</h2>
                {(profile?.city || profile?.location) && (
                  <p className="text-sm text-muted-foreground">
                    {[profile?.city, profile?.location].filter(Boolean).join(" · ")}
                  </p>
                )}
                {profile?.is_shop && profile?.seller_slug && (
                  <p className="mt-1">
                    <Link
                      href={sellerProfileHref(profile)}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      View public shop
                    </Link>
                  </p>
                )}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button asChild>
                <Link href="/dashboard/profile">Manage profile</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Core metrics — earnings, sales, orders, listings */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-4 xl:gap-4">
        {coreStats.map((stat) => (
          <Link key={stat.name} href={stat.href} className="min-w-0">
            <Card
              className={`h-full overflow-hidden hover:shadow-md transition-shadow ${
                stat.highlight ? "border-primary/20 bg-primary/5" : ""
              }`}
            >
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 flex-1 text-sm leading-snug text-muted-foreground">{stat.name}</p>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary sm:h-10 sm:w-10">
                    <stat.icon className="h-[1.125rem] w-[1.125rem] sm:h-5 sm:w-5" aria-hidden />
                  </div>
                </div>
                <p
                  className={`mt-3 min-w-0 break-words text-2xl font-bold tabular-nums tracking-tight sm:text-3xl ${
                    stat.highlight ? "text-primary" : ""
                  }`}
                >
                  {typeof stat.value === "number" ? stat.value.toLocaleString() : stat.value}
                  {stat.total !== undefined && stat.total > 0 && (
                    <span className="text-base font-normal text-muted-foreground sm:text-lg">
                      /{stat.total.toLocaleString()}
                    </span>
                  )}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium text-foreground">All-time earnings</h2>
        <Link href="/dashboard/earnings" className="min-w-0 block">
          <Card className="h-full overflow-hidden hover:shadow-md transition-shadow border-primary/15 bg-primary/[0.03]">
            <CardContent className="p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <TrendingUp className="h-4 w-4 shrink-0" aria-hidden />
                    <span>Lifetime earned on Reswell</span>
                  </div>
                  <p className="text-3xl font-bold tabular-nums tracking-tight text-primary sm:text-4xl">
                    ${allTimeEarned.toFixed(2)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1 text-sm font-medium text-primary">
                  View earnings
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium text-foreground">Activity</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
          {activityStats.map((stat) => (
            <Link key={stat.name} href={stat.href} className="min-w-0">
              <Card className="h-full overflow-hidden hover:shadow-md transition-shadow">
                <CardContent className="p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 flex-1 text-sm leading-snug text-muted-foreground">{stat.name}</p>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground sm:h-10 sm:w-10">
                      <stat.icon className="h-[1.125rem] w-[1.125rem] sm:h-5 sm:w-5" aria-hidden />
                    </div>
                  </div>
                  <p className="mt-3 text-2xl font-bold tabular-nums tracking-tight sm:text-3xl">
                    {stat.value.toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Followers & following */}
      <Card className="border-border">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Followers &amp; following
          </CardTitle>
          <Link
            href="/dashboard/following"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            View all
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-8 sm:gap-10">
            <div>
              <p className="text-3xl font-bold text-foreground tabular-nums">
                {followerCount.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">Followers</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-foreground tabular-nums">
                {followingCount.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">Following</p>
            </div>
            {newFollowersThisMonth > 0 && (
              <div>
                <p className="text-xl font-semibold text-green-600 tabular-nums">
                  +{newFollowersThisMonth.toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">new followers this month</p>
              </div>
            )}
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2.5">
            <Lightbulb className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Post new listings regularly to keep your followers engaged and coming back.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Published listings (active, sold, etc. — not drafts) */}
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
          <CardTitle className="text-lg">Your listings</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/listings">
              View All
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {publishedListings && publishedListings.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 xl:grid-cols-4 xl:gap-5">
              {publishedListings.map((listing) => {
                const primaryImage =
                  listing.listing_images?.find((img: { is_primary: boolean }) => img.is_primary) ||
                  listing.listing_images?.[0]
                return (
                  <Link
                    key={listing.id}
                    href={`/dashboard/listings/${listing.id}/edit`}
                    className="group min-w-0"
                  >
                    <div className="relative aspect-square rounded-lg overflow-hidden bg-muted mb-2">
                      {primaryImage?.url ? (
                        <Image
                          src={proxiedListingImageSrc(primaryImage.url) || "/placeholder.svg"}
                          alt={capitalizeWords(listing.title)}
                          fill
                          className="object-cover object-center group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                          No Image
                        </div>
                      )}
                      <Badge className="absolute top-2 left-2 bg-black/70 text-white border-0">
                        {listing.status}
                      </Badge>
                    </div>
                    <h3 className="text-sm font-medium leading-snug line-clamp-2 min-h-[2.75rem] sm:text-base sm:min-h-[3.25rem] group-hover:text-primary transition-colors">
                      {capitalizeWords(listing.title)}
                    </h3>
                    <p className="text-base font-bold tabular-nums text-black dark:text-white">
                      ${listing.price.toFixed(2)}
                    </p>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                No published listings yet{draftListings && draftListings.length > 0 ? " — finish a draft below" : ""}
              </p>
              <Button asChild>
                <Link href="/sell?new=1">Create a listing</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Drafts — only when there is at least one */}
      {draftListings && draftListings.length > 0 && (
        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
            <CardTitle className="text-lg">Drafts</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/listings">
                View All
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 xl:grid-cols-4 xl:gap-5">
              {draftListings.map((listing) => {
                const primaryImage =
                  listing.listing_images?.find((img: { is_primary: boolean }) => img.is_primary) ||
                  listing.listing_images?.[0]
                return (
                  <Link
                    key={listing.id}
                    href={`/dashboard/listings/${listing.id}/edit`}
                    className="group min-w-0"
                  >
                    <div className="relative aspect-square rounded-lg overflow-hidden bg-muted mb-2">
                      {primaryImage?.url ? (
                        <Image
                          src={proxiedListingImageSrc(primaryImage.url) || "/placeholder.svg"}
                          alt={capitalizeWords(listing.title)}
                          fill
                          className="object-cover object-center group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                          No Image
                        </div>
                      )}
                      <Badge className="absolute top-2 left-2 bg-black/70 text-white border-0">
                        draft
                      </Badge>
                    </div>
                    <h3 className="text-sm font-medium leading-snug line-clamp-2 min-h-[2.75rem] sm:text-base sm:min-h-[3.25rem] group-hover:text-primary transition-colors">
                      {capitalizeWords(listing.title)}
                    </h3>
                    <p className="text-base font-bold tabular-nums text-black dark:text-white">
                      ${listing.price.toFixed(2)}
                    </p>
                  </Link>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
            <Button variant="outline" className="h-auto py-4 flex-col bg-transparent" asChild>
              <Link href="/sell?new=1">
                <Plus className="h-6 w-6 mb-2" />
                Create listing
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col bg-transparent" asChild>
              <Link href="/dashboard/profile">
                <UserCircle className="h-6 w-6 mb-2" />
                Profile
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col bg-transparent" asChild>
              <Link href="/dashboard/listings">
                <List className="h-6 w-6 mb-2" />
                My listings
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col bg-transparent" asChild>
              <Link href="/dashboard/orders">
                <ShoppingBag className="h-6 w-6 mb-2" />
                Orders
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col bg-transparent" asChild>
              <Link href="/dashboard/sales">
                <PackageCheck className="h-6 w-6 mb-2" />
                Sales
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col bg-transparent" asChild>
              <Link href="/messages">
                <MessageSquare className="h-6 w-6 mb-2" />
                Messages
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col bg-transparent" asChild>
              <Link href="/favorites">
                <Heart className="h-6 w-6 mb-2" />
                Favorites
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col bg-transparent" asChild>
              <Link href="/dashboard/earnings">
                <Wallet className="h-6 w-6 mb-2" />
                Earnings
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
