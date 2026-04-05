"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { FollowButton } from "@/components/follows/follow-button"
import { MapPin, Users, Loader2, Package } from "lucide-react"
import { cn } from "@/lib/utils"
import { capitalizeWords } from "@/lib/listing-labels"
import { sellerProfileHref } from "@/lib/seller-slug"

type Listing = {
  id: string
  title: string
  price: number
  slug: string | null
  section: string
  created_at: string
  city: string | null
  state: string | null
  listing_images?: { url: string; is_primary: boolean }[]
  seller: {
    id: string
    seller_slug: string | null
    display_name: string | null
    shop_name: string | null
    avatar_url: string | null
    city: string | null
  }
}

type SuggestedSeller = {
  id: string
  seller_slug: string | null
  display_name: string | null
  shop_name: string | null
  avatar_url: string | null
  shop_logo_url: string | null
  city: string | null
  follower_count: number
}

interface Props {
  userId: string
  initialListings: Listing[]
  followCount: number
  userCity: string | null
  suggestedSellers: SuggestedSeller[]
}

const SECTIONS = [
  { label: "All", value: "all" },
  { label: "Surfboards", value: "surfboards" },
  { label: "Wetsuits", value: "wetsuits" },
  { label: "Fins", value: "fins" },
  { label: "Used gear", value: "used" },
]

const ONE_DAY_MS = 24 * 60 * 60 * 1000

function isNew(dateStr: string) {
  return Date.now() - new Date(dateStr).getTime() < ONE_DAY_MS
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return "Yesterday"
  return `${days}d ago`
}

function getListingHref(listing: Listing): string {
  const id = listing.slug || listing.id
  if (listing.section === "surfboards") return `/boards/${id}`
  if (listing.section === "new") return `/shop/${listing.id}`
  return `/${id}`
}

export function FollowingFeedClient({
  userId,
  initialListings,
  followCount,
  userCity,
  suggestedSellers,
}: Props) {
  const [listings, setListings] = useState<Listing[]>(initialListings)
  const [activeSection, setActiveSection] = useState("all")
  const [loadingMore, setLoadingMore] = useState(false)
  const [cursor, setCursor] = useState<string | null>(
    initialListings.length === 20
      ? initialListings[initialListings.length - 1]?.created_at ?? null
      : null
  )
  const [hasMore, setHasMore] = useState(initialListings.length === 20)
  const [localTab, setLocalTab] = useState<"all" | "local">("all")

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return
    setLoadingMore(true)
    try {
      const params = new URLSearchParams({ cursor, limit: "20" })
      const res = await fetch(`/api/following/feed?${params}`)
      if (!res.ok) return
      const data = await res.json()
      setListings((prev) => [...prev, ...(data.listings ?? [])])
      setHasMore(data.hasMore)
      setCursor(data.nextCursor ?? null)
    } finally {
      setLoadingMore(false)
    }
  }, [cursor, loadingMore])

  const filtered = listings.filter((l) => {
    if (activeSection !== "all" && l.section !== activeSection) return false
    if (localTab === "local" && userCity) {
      const sellerCity = l.seller?.city || l.city
      if (!sellerCity?.toLowerCase().includes(userCity.toLowerCase())) return false
    }
    return true
  })

  // Group by seller for display
  const grouped: {
    sellerId: string
    sellerSlug: string | null
    sellerName: string
    sellerCity: string | null
    avatarUrl: string | null
    listings: Listing[]
  }[] = []
  const seen = new Set<string>()
  for (const l of filtered) {
    const sid = l.seller?.id
    if (!sid) continue
    if (!seen.has(sid)) {
      seen.add(sid)
      grouped.push({
        sellerId: sid,
        sellerSlug: l.seller.seller_slug,
        sellerName: l.seller.shop_name || l.seller.display_name || "Seller",
        sellerCity: l.seller.city,
        avatarUrl: l.seller.avatar_url,
        listings: [],
      })
    }
    grouped[grouped.length - 1]?.listings.push(l)
  }

  // Re-group properly (above algo is wrong for out-of-order sellers)
  const groupMap = new Map<string, (typeof grouped)[0]>()
  for (const l of filtered) {
    const sid = l.seller?.id
    if (!sid) continue
    if (!groupMap.has(sid)) {
      groupMap.set(sid, {
        sellerId: sid,
        sellerSlug: l.seller.seller_slug,
        sellerName: l.seller.shop_name || l.seller.display_name || "Seller",
        sellerCity: l.seller.city,
        avatarUrl: l.seller.avatar_url,
        listings: [],
      })
    }
    groupMap.get(sid)!.listings.push(l)
  }
  const sellerGroups = Array.from(groupMap.values())

  if (followCount === 0) {
    return <EmptyState userId={userId} suggestedSellers={suggestedSellers} userCity={userCity} />
  }

  return (
    <div className="container mx-auto py-8 max-w-3xl">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Your feed</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Listings from sellers you follow
        </p>
      </div>

      {/* Tabs: All / Local */}
      <div className="flex items-center gap-1 mb-4">
        <Button
          variant={localTab === "all" ? "default" : "ghost"}
          size="sm"
          onClick={() => setLocalTab("all")}
        >
          All
        </Button>
        {userCity && (
          <Button
            variant={localTab === "local" ? "default" : "ghost"}
            size="sm"
            onClick={() => setLocalTab("local")}
            className="flex items-center gap-1.5"
          >
            <MapPin className="h-3.5 w-3.5" />
            Local sellers
          </Button>
        )}
      </div>

      {/* Section filters */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        {SECTIONS.map((s) => (
          <button
            key={s.value}
            onClick={() => setActiveSection(s.value)}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm font-medium transition-colors border",
              activeSection === s.value
                ? "bg-foreground text-background border-foreground"
                : "bg-background text-muted-foreground border-border hover:border-foreground/40 hover:text-foreground"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Feed */}
      {sellerGroups.length === 0 ? (
        <div className="text-center py-16">
          <Package className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">
            {localTab === "local"
              ? "No local listings in the last 30 days."
              : "No new listings in the last 30 days. Check back soon!"}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {sellerGroups.map((group) => {
            const latestDate = group.listings[0]?.created_at
            return (
              <div key={group.sellerId} className="space-y-3">
                {/* Seller header */}
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarImage src={group.avatarUrl || ""} alt={group.sellerName} />
                    <AvatarFallback className="text-sm font-semibold bg-primary text-primary-foreground">
                      {group.sellerName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={sellerProfileHref({
                        seller_slug: group.sellerSlug,
                      })}
                      className="font-semibold text-sm hover:underline"
                    >
                      {group.sellerName}
                    </Link>
                    {group.sellerCity && (
                      <span className="text-muted-foreground text-sm"> · {group.sellerCity}</span>
                    )}
                    <span className="text-muted-foreground text-sm">
                      {" "}· {group.listings.length} new listing{group.listings.length !== 1 ? "s" : ""}
                    </span>
                    {latestDate && (
                      <span className="text-muted-foreground text-xs ml-1">
                        · {timeAgo(latestDate)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Listings grid for this seller */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {group.listings.map((listing) => {
                    const img =
                      listing.listing_images?.find((i) => i.is_primary) ||
                      listing.listing_images?.[0]
                    return (
                      <Link key={listing.id} href={getListingHref(listing)}>
                        <Card className="overflow-hidden hover:shadow-md transition-shadow group">
                          <div className="aspect-[3/4] relative bg-muted overflow-hidden">
                            {img?.url ? (
                              <Image
                                src={img.url}
                                alt={listing.title}
                                fill
                                className="object-cover group-hover:scale-105 transition-transform duration-300"
                                sizes="(max-width: 640px) 50vw, 33vw"
                              />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs">
                                No image
                              </div>
                            )}
                            {isNew(listing.created_at) && (
                              <Badge className="absolute top-2 left-2 bg-green-500 text-white text-[10px] px-1.5 py-0.5 uppercase tracking-wide">
                                New
                              </Badge>
                            )}
                          </div>
                          <CardContent className="p-3">
                            <p className="text-sm font-medium line-clamp-2 min-h-[2.8em]">
                              {capitalizeWords(listing.title)}
                            </p>
                            <p className="text-base font-bold mt-1">
                              ${Number(listing.price).toFixed(2)}
                            </p>
                            {(listing.city || listing.state) && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                <MapPin className="h-2.5 w-2.5" />
                                {listing.city}
                                {listing.state ? `, ${listing.state}` : ""}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Load more */}
          {hasMore && (
            <div className="text-center pt-2">
              <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading…
                  </>
                ) : (
                  "Load more"
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function EmptyState({
  userId,
  suggestedSellers,
  userCity,
}: {
  userId: string
  suggestedSellers: SuggestedSeller[]
  userCity: string | null
}) {
  return (
    <div className="container mx-auto py-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Your feed</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Listings from sellers you follow
        </p>
      </div>

      <div className="rounded-xl border border-border bg-muted/30 px-6 py-12 text-center mb-10">
        <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold mb-2">Follow sellers to see their new listings here</h2>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-5">
          When sellers you follow post new gear, it shows up right here — chronological, no algorithm.
        </p>
        <Button asChild variant="outline">
          <Link href="/gear">Browse gear</Link>
        </Button>
      </div>

      {suggestedSellers.length > 0 && (
        <div>
          <h2 className="text-base font-semibold mb-1">
            {userCity ? `Sellers${userCity ? ` · ${userCity}` : ""}` : "Popular sellers"}
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Active sellers with lots of fresh inventory
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {suggestedSellers.map((seller) => {
              const name = seller.shop_name || seller.display_name || "Seller"
              const avatar = seller.shop_logo_url || seller.avatar_url || ""
              return (
                <Card key={seller.id} className="p-4 flex items-center gap-3">
                  <Avatar className="h-11 w-11 shrink-0">
                    <AvatarImage src={avatar} alt={name} />
                    <AvatarFallback className="font-semibold bg-primary text-primary-foreground">
                      {name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={sellerProfileHref(seller)}
                      className="font-medium text-sm hover:underline truncate block"
                    >
                      {name}
                    </Link>
                    {seller.city && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {seller.city}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {seller.follower_count.toLocaleString()} followers
                    </p>
                  </div>
                  <FollowButton
                    sellerId={seller.id}
                    sellerSlug={seller.seller_slug}
                    sellerName={name}
                    sellerCity={seller.city || undefined}
                    initialFollowing={false}
                    initialFollowerCount={seller.follower_count}
                    isLoggedIn={true}
                    isOwnProfile={seller.id === userId}
                    size="sm"
                  />
                </Card>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
