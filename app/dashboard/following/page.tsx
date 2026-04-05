import { redirect } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { getCachedDashboardSession } from "@/lib/dashboard-session"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MapPin, Package, Users, ExternalLink } from "lucide-react"
import { UnfollowButton } from "./unfollow-button"
import { capitalizeWords } from "@/lib/listing-labels"
import { sellerProfileHref } from "@/lib/seller-slug"

export const metadata = {
  title: "Following — Dashboard",
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

export default async function FollowingPage() {
  const { supabase, user } = await getCachedDashboardSession()

  if (!user) redirect("/auth/login?redirect=/dashboard/following")

  // Get all followed sellers with profile data
  const { data: follows } = await supabase
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
    .order("created_at", { ascending: false })

  const followList = follows ?? []

  // Fetch listing stats for each followed seller
  const sellerIds = followList.map((f) => (f.seller as any)?.id).filter(Boolean)
  const { data: listingStats } = sellerIds.length
    ? await supabase
        .from("listings")
        .select("user_id, created_at, title, price, slug, section, listing_images(url, is_primary)")
        .in("user_id", sellerIds)
        .eq("status", "active")
        .order("created_at", { ascending: false })
    : { data: [] }

  type ListingStat = { count: number; lastAt: string | null; sample: any | null }
  const statsByUser: Record<string, ListingStat> = {}
  for (const l of listingStats ?? []) {
    if (!statsByUser[l.user_id]) {
      statsByUser[l.user_id] = { count: 0, lastAt: null, sample: null }
    }
    statsByUser[l.user_id].count++
    if (!statsByUser[l.user_id].lastAt || l.created_at > statsByUser[l.user_id].lastAt!) {
      statsByUser[l.user_id].lastAt = l.created_at
      statsByUser[l.user_id].sample = l
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Following</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {followList.length > 0
            ? `You follow ${followList.length} seller${followList.length !== 1 ? "s" : ""}`
            : "You're not following any sellers yet"}
        </p>
      </div>

      {followList.length === 0 ? (
        <Card className="flex flex-col items-center gap-4 py-14 px-6 text-center">
          <Users className="h-12 w-12 text-muted-foreground" />
          <div>
            <p className="font-semibold text-foreground mb-1">No sellers followed yet</p>
            <p className="text-sm text-muted-foreground max-w-sm">
              Follow your favorite local sellers to get notified when they post new gear.
            </p>
          </div>
          <Link
            href="/following"
            className="text-sm font-medium text-primary hover:underline"
          >
            Find sellers to follow →
          </Link>
        </Card>
      ) : (
        <div className="space-y-3">
          {followList.map((follow) => {
            const s = follow.seller as any
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
                          <span>
                            Last listed {timeAgo(stats.lastAt)}
                          </span>
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

                    {/* Latest listing preview */}
                    {stats.sample && (
                      <div className="mt-3 flex items-center gap-3 p-2.5 rounded-lg bg-muted/50">
                        {(() => {
                          const img = stats.sample.listing_images?.find((i: any) => i.is_primary) || stats.sample.listing_images?.[0]
                          const href =
                            stats.sample.section === "surfboards"
                              ? `/boards/${stats.sample.slug || stats.sample.id}`
                              : stats.sample.section === "new"
                                ? `/shop/${stats.sample.id}`
                                : `/${stats.sample.slug || stats.sample.id}`
                          return (
                            <Link href={href} className="flex items-center gap-3 flex-1 min-w-0">
                              {img?.url && (
                                <div className="relative h-10 w-10 rounded overflow-hidden bg-background shrink-0">
                                  <Image
                                    src={img.url}
                                    alt={stats.sample.title}
                                    fill
                                    className="object-cover"
                                    sizes="40px"
                                  />
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="text-xs font-medium truncate">
                                  {capitalizeWords(stats.sample.title)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  ${Number(stats.sample.price).toFixed(2)} · Latest listing
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
        </div>
      )}

      {followList.length > 0 && (
        <div className="pt-2">
          <Link
            href="/following"
            className="text-sm font-medium text-primary hover:underline"
          >
            View your feed →
          </Link>
        </div>
      )}
    </div>
  )
}
