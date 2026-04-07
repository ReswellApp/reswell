import { redirect } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { getCachedDashboardSession } from "@/lib/dashboard-session"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MapPin, Package, Users, ExternalLink, TrendingUp, Lightbulb } from "lucide-react"
import { UnfollowButton } from "./unfollow-button"
import { FollowersTabs } from "./followers-tabs"
import { capitalizeWords } from "@/lib/listing-labels"
import { sellerProfileHref } from "@/lib/seller-slug"
import { listingDetailHref } from "@/lib/listing-href"

export const metadata = {
  title: "Followers — Dashboard",
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "Never"
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / (24 * 60 * 60 * 1000))
  if (days === 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

export default async function FollowersDashboardPage() {
  const { supabase, user } = await getCachedDashboardSession()

  if (!user) redirect("/auth/login?redirect=/dashboard/followers")

  const [followsRes, profileRes, newThisMonthRes] = await Promise.all([
    supabase
      .from("seller_follows")
      .select(`
      id,
      seller_id,
      created_at,
      seller:profiles!seller_follows_seller_id_fkey (
        id,
        seller_slug,
        display_name,
        shop_name,
        avatar_url,
        shop_logo_url,
        city,
        shop_address,
        follower_count
      )
    `)
      .eq("follower_id", user.id)
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("follower_count").eq("id", user.id).single(),
    supabase
      .from("seller_follows")
      .select("id", { count: "exact", head: true })
      .eq("seller_id", user.id)
      .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
  ])

  const followList = followsRes.data ?? []
  const followerCount = profileRes.data?.follower_count ?? 0
  const newThisMonth = newThisMonthRes.count ?? 0

  const sellerIds = followList.map((f) => (f.seller as { id?: string } | null)?.id).filter(Boolean) as string[]
  const { data: listingStats } = sellerIds.length
    ? await supabase
        .from("listings")
        .select("user_id, created_at, title, price, slug, section, listing_images(url, is_primary)")
        .in("user_id", sellerIds)
        .eq("status", "active")
        .order("created_at", { ascending: false })
    : { data: [] }

  type ListingStat = { count: number; lastAt: string | null; sample: Record<string, unknown> | null }
  const statsByUser: Record<string, ListingStat> = {}
  const listingRows = (listingStats ?? []) as Array<{
    user_id: string
    created_at: string
    title: string
    price: number
    slug: string | null
    section: string
    listing_images?: { url: string; is_primary?: boolean }[] | null
  }>
  for (const l of listingRows) {
    if (!statsByUser[l.user_id]) {
      statsByUser[l.user_id] = { count: 0, lastAt: null, sample: null }
    }
    statsByUser[l.user_id].count++
    if (!statsByUser[l.user_id].lastAt || l.created_at > statsByUser[l.user_id].lastAt!) {
      statsByUser[l.user_id].lastAt = l.created_at
      statsByUser[l.user_id].sample = l as unknown as Record<string, unknown>
    }
  }

  const followingPanel =
    followList.length === 0 ? (
      <Card className="flex flex-col items-center gap-4 py-14 px-6 text-center">
        <Users className="h-12 w-12 text-muted-foreground" />
        <div>
          <p className="font-semibold text-foreground mb-1">No sellers followed yet</p>
          <p className="text-sm text-muted-foreground max-w-sm">
            Follow your favorite local sellers to get notified when they post new gear.
          </p>
        </div>
        <Link href="/following" className="text-sm font-medium text-primary hover:underline">
          Find sellers to follow →
        </Link>
      </Card>
    ) : (
      <div className="space-y-3">
        {followList.map((follow) => {
          const s = follow.seller as unknown as {
            id: string
            seller_slug?: string | null
            display_name?: string | null
            shop_name?: string | null
            avatar_url?: string | null
            shop_logo_url?: string | null
            city?: string | null
            shop_address?: string | null
            follower_count?: number | null
          } | null
          if (!s) return null
          const name = s.shop_name || s.display_name || "Seller"
          const avatar = s.shop_logo_url || s.avatar_url || ""
          const location = s.shop_address || s.city
          const stats = statsByUser[s.id] ?? { count: 0, lastAt: null, sample: null }

          return (
            <Card key={follow.id} className="p-4">
              <div className="flex items-start gap-4">
                <Avatar className="h-12 w-12 shrink-0">
                  <AvatarImage src={avatar} alt={name} />
                  <AvatarFallback className="font-semibold bg-primary text-primary-foreground">
                    {name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <Link
                        href={sellerProfileHref(s)}
                        className="font-semibold text-foreground hover:underline"
                      >
                        {name}
                      </Link>
                      {location && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                          <MapPin className="h-3.5 w-3.5 shrink-0" />
                          {location}
                        </div>
                      )}
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Package className="h-3.5 w-3.5" />
                          {stats.count} active listing{stats.count !== 1 ? "s" : ""}
                        </span>
                        <span>Last listed {timeAgo(stats.lastAt)}</span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {(s.follower_count ?? 0).toLocaleString()} followers
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Link
                        href={sellerProfileHref(s)}
                        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        View shop
                      </Link>
                      <UnfollowButton sellerId={s.id} sellerName={name} followId={follow.id} />
                    </div>
                  </div>

                  {stats.sample && (
                    <div className="mt-3 flex items-center gap-3 p-2.5 rounded-lg bg-muted/50">
                      {(() => {
                        const sample = stats.sample as {
                          id: string
                          title: string
                          price: number
                          slug?: string | null
                          section?: string
                          listing_images?: { url: string; is_primary?: boolean }[]
                        }
                        const img =
                          sample.listing_images?.find((i) => i.is_primary) || sample.listing_images?.[0]
                        const href = listingDetailHref(sample)
                        return (
                          <Link href={href} className="flex items-center gap-3 flex-1 min-w-0">
                            {img?.url && (
                              <div className="relative h-10 w-10 rounded overflow-hidden bg-background shrink-0">
                                <Image
                                  src={img.url}
                                  alt={sample.title}
                                  fill
                                  className="object-cover"
                                  sizes="40px"
                                />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate">
                                {capitalizeWords(sample.title)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                ${Number(sample.price).toFixed(2)} · Latest listing
                              </p>
                            </div>
                          </Link>
                        )
                      })()}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )
        })}
        <div className="pt-2">
          <Link href="/following" className="text-sm font-medium text-primary hover:underline">
            View your feed →
          </Link>
        </div>
      </div>
    )

  const followersPanel = (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Total followers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{followerCount.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              New this month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">+{newThisMonth.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
        <CardContent className="pt-5">
          <div className="flex gap-3">
            <Lightbulb className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-blue-900 dark:text-blue-200 text-sm">
                Keep your followers engaged
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                Post new listings regularly. Every time you list something new, all your followers get an in-app
                notification and a daily email digest — bringing them back to your shop.
              </p>
              <Link
                href="/sell"
                className="mt-2 inline-block text-sm font-medium text-blue-700 dark:text-blue-300 hover:underline"
              >
                List new gear →
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Follower list is private. Buyers can follow any seller; you can only see your total count, not who they are.
      </p>
    </>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Followers</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Sellers you follow and people following your shop
        </p>
      </div>

      <FollowersTabs followingPanel={followingPanel} followersPanel={followersPanel} />
    </div>
  )
}
