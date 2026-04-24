import { redirect } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { getCachedDashboardSession } from "@/lib/dashboard-session"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MapPin, Users, TrendingUp, Heart } from "lucide-react"
import { UnfollowButton } from "@/app/dashboard/followers/unfollow-button"
import { capitalizeWords } from "@/lib/listing-labels"
import { sellerProfileHref } from "@/lib/seller-slug"
import { listingDetailHref } from "@/lib/listing-href"
import { proxiedListingImageSrc } from "@/lib/listing-media-proxy-url"

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

function formatShortDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

function followerDisplayName(
  f: { display_name: string | null; shop_name: string | null; is_shop: boolean | null },
) {
  if (f.is_shop && f.shop_name?.trim()) return f.shop_name.trim()
  return f.display_name?.trim() || "Reswell member"
}

function publicFollowerHref(f: { id: string; seller_slug: string | null }) {
  const slug = f.seller_slug?.trim()
  if (slug) return `/sellers/${slug}`
  return `/sellers/${f.id}`
}

export async function FollowersDashboardPanels() {
  const { supabase, user } = await getCachedDashboardSession()

  const loginRedirect = "/dashboard/followers"
  if (!user) redirect(`/auth/login?redirect=${encodeURIComponent(loginRedirect)}`)

  const [followsRes, profileRes, newThisMonthRes, myFollowersRes] = await Promise.all([
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
    supabase
      .from("seller_follows")
      .select(
        `
        id,
        created_at,
        follower:profiles!seller_follows_follower_id_fkey (
          id,
          display_name,
          avatar_url,
          city,
          location,
          seller_slug,
          is_shop,
          shop_name,
          shop_logo_url
        )
      `,
      )
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200),
  ])

  const followList = followsRes.data ?? []
  const followerCount = profileRes.data?.follower_count ?? 0
  const newThisMonth = newThisMonthRes.count ?? 0
  const myFollowerRows = (myFollowersRes.data ?? []) as Array<{
    id: string
    created_at: string
    follower: {
      id: string
      display_name: string | null
      avatar_url: string | null
      city: string | null
      location: string | null
      seller_slug: string | null
      is_shop: boolean | null
      shop_name: string | null
      shop_logo_url: string | null
    } | null
  }>
  const showFollowerListCap = followerCount > 200
  const followingCount = followList.length

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

  const statStrip = (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Card>
        <CardContent className="p-4 sm:p-5">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" aria-hidden />
            Follows you
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight">{followerCount.toLocaleString()}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 sm:p-5">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" aria-hidden />
            New this month
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight">
            +{newThisMonth.toLocaleString()}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 sm:p-5">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Heart className="h-3.5 w-3.5" aria-hidden />
            You follow
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight">{followingCount.toLocaleString()}</p>
        </CardContent>
      </Card>
    </div>
  )

  const peopleFollowingYou = (
    <section id="people-following-you" className="scroll-mt-8 space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-foreground">People into your shop</h2>
          <p className="text-sm text-muted-foreground mt-0.5 max-w-xl">
            Only you see this. Say hi by listing something new.
          </p>
        </div>
        {showFollowerListCap && (
          <p className="text-xs text-muted-foreground">Showing 200 most recent</p>
        )}
      </div>

      {myFollowerRows.length === 0 ? (
        <Card className="border-dashed border-border bg-muted/20">
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Users className="h-9 w-9 text-muted-foreground" />
            <p className="font-medium text-foreground">Nobody here yet—your first follower is on the way</p>
            <p className="text-sm text-muted-foreground max-w-md">
              Share your shop and keep listing. When someone follows you, they’ll pop up in this list.
            </p>
            <div className="mt-1 flex flex-wrap justify-center gap-2">
              <Button asChild size="sm">
                <Link href="/sell?new=1">List gear</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/sellers">Browse sellers</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {myFollowerRows.map((row) => {
            const f = row.follower
            if (!f) return null
            const name = followerDisplayName(f)
            const avatar = f.is_shop ? f.shop_logo_url || f.avatar_url : f.avatar_url
            const place = f.city || f.location

            return (
              <li key={row.id}>
                <Card className="border-border/80 transition-shadow hover:shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3 sm:gap-4">
                      <Link
                        href={publicFollowerHref(f)}
                        className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-muted"
                      >
                        {avatar ? (
                          <Image
                            src={avatar}
                            alt=""
                            width={48}
                            height={48}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-muted-foreground">
                            {name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </Link>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <Link
                              href={publicFollowerHref(f)}
                              className="font-semibold text-foreground hover:underline"
                            >
                              {name}
                            </Link>
                            {f.is_shop && (
                              <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                                Shop
                              </span>
                            )}
                            {place && (
                              <div className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                {place}
                              </div>
                            )}
                            <div className="mt-1.5 text-xs text-muted-foreground">
                              <span title={formatShortDate(row.created_at)}>Since {timeAgo(row.created_at)}</span>
                            </div>
                          </div>
                          <Link
                            href={publicFollowerHref(f)}
                            className="shrink-0 text-sm font-medium text-primary hover:underline"
                          >
                            View →
                          </Link>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )

  const shopsYouFollow = (
    <section id="shops-you-follow" className="scroll-mt-8 space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Heart className="h-5 w-5 text-rose-500" aria-hidden />
          Sellers you follow
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">We’ll nudge you when they drop new listings.</p>
      </div>

      {followList.length === 0 ? (
        <Card className="border-dashed border-rose-200/50 bg-rose-50/30 dark:border-rose-900/40 dark:bg-rose-950/15">
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <span className="text-2xl" aria-hidden>
              🏄
            </span>
            <p className="font-medium text-foreground">Find sellers you care about</p>
            <p className="text-sm text-muted-foreground max-w-sm">
              Follow a shop to see their new boards in your feed and notifications.
            </p>
            <Button asChild size="sm" variant="secondary" className="mt-1">
              <Link href="/following">Open discover</Link>
            </Button>
          </CardContent>
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
              <Card key={follow.id} className="border-border/80 overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <Avatar className="h-12 w-12 shrink-0">
                      <AvatarImage src={avatar} alt="" />
                      <AvatarFallback className="font-semibold bg-primary text-primary-foreground">
                        {name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <Link
                            href={sellerProfileHref(s)}
                            className="font-semibold text-foreground hover:underline"
                          >
                            {name}
                          </Link>
                          {location && (
                            <div className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                              <MapPin className="h-3.5 w-3.5 shrink-0" />
                              {location}
                            </div>
                          )}
                          <p className="mt-1 text-xs text-muted-foreground">
                            {stats.count} listing{stats.count !== 1 ? "s" : ""} now · last activity{" "}
                            {timeAgo(stats.lastAt)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Button asChild size="sm" variant="ghost" className="h-8 text-primary">
                            <Link href={sellerProfileHref(s)}>Shop</Link>
                          </Button>
                          <UnfollowButton sellerId={s.id} sellerName={name} followId={follow.id} />
                        </div>
                      </div>
                      {stats.sample && (
                        <div className="mt-3 flex items-center gap-2 rounded-lg bg-muted/50 p-2">
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
                              <Link href={href} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                                {img?.url && (
                                  <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded bg-background">
                                    <Image
                                      src={proxiedListingImageSrc(img.url)}
                                      alt=""
                                      fill
                                      className="object-cover"
                                      sizes="36px"
                                    />
                                  </div>
                                )}
                                <span className="truncate text-xs text-muted-foreground">
                                  Latest: <span className="font-medium text-foreground">{capitalizeWords(sample.title)}</span>{" "}
                                  · ${Number(sample.price).toFixed(2)}
                                </span>
                              </Link>
                            )
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
          <p>
            <Link href="/following" className="text-sm font-medium text-primary hover:underline">
              View your follow feed →
            </Link>
          </p>
        </div>
      )}
    </section>
  )

  return (
    <div className="space-y-8 sm:space-y-10 pb-10 sm:pb-12">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Your community</h1>
        <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
          One scroll: who’s watching your shop, who you’re watching, and a nudge to keep the stoke going.
        </p>
      </header>

      {statStrip}
      {peopleFollowingYou}
      {shopsYouFollow}
    </div>
  )
}
