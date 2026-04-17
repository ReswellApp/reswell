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
} from "lucide-react"
import { capitalizeWords } from "@/lib/listing-labels"
import { reconcileWalletAggregates, walletAggregateStrings } from "@/lib/wallet-reconcile"

export const metadata = privatePageMetadata({
  title: "Dashboard — Reswell",
  description:
    "Your Reswell home: listings, orders, wallet, offers, and messages — manage your surf marketplace activity.",
  path: "/dashboard",
})

export default async function DashboardPage() {
  const { supabase, user } = await getCachedDashboardSession()

  if (!user) return null

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
      .neq("status", "draft")
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

  let walletBalance = 0
  if (walletRow) {
    const r = reconcileWalletAggregates(walletRow)
    walletBalance = r.totalBalance
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

  const stats = [
    {
      name: "Earnings",
      value: `$${walletBalance.toFixed(2)}`,
      icon: Wallet,
      href: "/dashboard/earnings",
      highlight: true,
    },
    {
      name: "Active Listings",
      value: activeListings,
      total: listingCount || 0,
      icon: Package,
      href: "/dashboard/listings",
    },
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
      name: "Unread Messages",
      value: unreadCount || 0,
      icon: MessageSquare,
      href: "/messages",
    },
  ]

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Welcome */}
      <div className="max-w-3xl">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
          Welcome back, {profile?.display_name || user.user_metadata?.full_name || "User"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          Here is what is happening with your listings
        </p>
      </div>

      {/* Stats — 2×2 on sm; five cards on xl */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-5 xl:gap-4">
        {stats.map((stat) => (
          <Link key={stat.name} href={stat.href} className="min-w-0">
            <Card
              className={`h-full overflow-hidden hover:shadow-md transition-shadow ${
                (stat as { highlight?: boolean }).highlight ? "border-primary/20 bg-primary/5" : ""
              }`}
            >
              <CardContent className="p-5 sm:p-6">
                {/* Label + icon on one row so the value row stays full-width (avoids overlap in narrow 5-up layouts). */}
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 flex-1 text-sm leading-snug text-muted-foreground">
                    {stat.name}
                  </p>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary sm:h-10 sm:w-10">
                    <stat.icon className="h-[1.125rem] w-[1.125rem] sm:h-5 sm:w-5" aria-hidden />
                  </div>
                </div>
                <p
                  className={`mt-3 min-w-0 break-words text-2xl font-bold tabular-nums tracking-tight sm:text-3xl ${
                    (stat as { highlight?: boolean }).highlight ? "text-primary" : ""
                  }`}
                >
                  {stat.value}
                  {stat.total !== undefined && stat.total > 0 && (
                    <span className="text-base font-normal text-muted-foreground sm:text-lg">
                      /{stat.total}
                    </span>
                  )}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Follower stats (shown when user has followers OR is a seller) */}
      {(followerCount > 0 || newFollowersThisMonth > 0) && (
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Your followers
            </CardTitle>
            <Link
              href="/dashboard/profile#followers"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              View stats
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-6">
              <div>
                <p className="text-3xl font-bold text-foreground">
                  {followerCount.toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">followers total</p>
              </div>
              {newFollowersThisMonth > 0 && (
                <div>
                  <p className="text-xl font-semibold text-green-600">
                    +{newFollowersThisMonth.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">this month</p>
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
      )}

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
                          src={primaryImage.url || "/placeholder.svg"}
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
                          src={primaryImage.url || "/placeholder.svg"}
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
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
            <Button variant="outline" className="h-auto py-4 flex-col bg-transparent" asChild>
              <Link href="/sell?new=1">
                <Package className="h-6 w-6 mb-2" />
                Create Listing
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col bg-transparent" asChild>
              <Link href="/messages">
                <MessageSquare className="h-6 w-6 mb-2" />
                View Messages
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
