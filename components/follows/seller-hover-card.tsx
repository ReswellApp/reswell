"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MapPin, Star, Package, ExternalLink } from "lucide-react"
import { FollowButton } from "@/components/follows/follow-button"
import { createClient } from "@/lib/supabase/client"
import { sellerProfileHref } from "@/lib/seller-slug"

interface SellerHoverCardProps {
  sellerId: string
  /** When known (e.g. from listing join), avoids waiting on profile fetch for links. */
  sellerSlug?: string | null
  sellerName: string
  sellerCity?: string
  children: React.ReactNode
  /** Whether the viewing user is logged in (passed from server component) */
  isLoggedIn?: boolean
  /** Whether this is the user's own profile */
  isOwnProfile?: boolean
}

interface SellerData {
  seller_slug: string | null
  display_name: string | null
  shop_name: string | null
  is_shop: boolean | null
  avatar_url: string | null
  shop_logo_url: string | null
  city: string | null
  shop_address: string | null
  follower_count: number
  shop_verified: boolean
  created_at: string
}

interface RecentListing {
  id: string
  title: string
  slug: string | null
  section: string
  price: number
  listing_images?: { url: string; is_primary: boolean }[]
}

interface ReviewStats {
  avg: number
  count: number
}

export function SellerHoverCard({
  sellerId,
  sellerSlug: sellerSlugProp,
  sellerName,
  sellerCity,
  children,
  isLoggedIn = false,
  isOwnProfile = false,
}: SellerHoverCardProps) {
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [seller, setSeller] = useState<SellerData | null>(null)
  const [listings, setListings] = useState<RecentListing[]>([])
  const [reviews, setReviews] = useState<ReviewStats>({ avg: 0, count: 0 })
  const [following, setFollowing] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const supabase = createClient()

  const loadData = useCallback(async () => {
    if (loaded) return
    setLoaded(true)

    const [profileRes, listingsRes, reviewsRes, followStatusRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("seller_slug, is_shop, display_name, shop_name, avatar_url, shop_logo_url, city, shop_address, follower_count, shop_verified, created_at")
        .eq("id", sellerId)
        .single(),
      supabase
        .from("listings")
        .select("id, title, slug, section, price, listing_images(url, is_primary)")
        .eq("user_id", sellerId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(3),
      supabase
        .from("reviews")
        .select("rating")
        .eq("reviewed_id", sellerId),
      isLoggedIn
        ? fetch(`/api/follows/status?sellerId=${sellerId}`).then((r) => r.json())
        : Promise.resolve({ following: false, followerCount: 0 }),
    ])

    if (profileRes.data) setSeller(profileRes.data as SellerData)
    if (listingsRes.data) setListings(listingsRes.data as RecentListing[])
    if (reviewsRes.data && reviewsRes.data.length > 0) {
      const avg = reviewsRes.data.reduce((s, r) => s + r.rating, 0) / reviewsRes.data.length
      setReviews({ avg, count: reviewsRes.data.length })
    }
    if (followStatusRes) {
      setFollowing(followStatusRes.following ?? false)
      setFollowerCount(followStatusRes.followerCount ?? 0)
    }
  }, [loaded, sellerId, isLoggedIn, supabase])

  function handleMouseEnter() {
    openTimer.current = setTimeout(() => {
      setOpen(true)
      loadData()
    }, 300)
  }

  function handleMouseLeave() {
    if (openTimer.current) clearTimeout(openTimer.current)
  }

  useEffect(() => {
    return () => {
      if (openTimer.current) clearTimeout(openTimer.current)
    }
  }, [])

  const displayName = seller?.shop_name || seller?.display_name || sellerName
  const avatarSrc = seller?.shop_logo_url || seller?.avatar_url || ""
  const location = seller?.shop_address || seller?.city || sellerCity
  const shopProfilePath = sellerProfileHref({
    seller_slug: seller?.seller_slug ?? sellerSlugProp,
  })

  function getListingHref(l: RecentListing) {
    const id = l.slug || l.id
    if (l.section === "surfboards") return `/boards/${id}`
    if (l.section === "new") return `/shop/${l.id}`
    return `/${id}`
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className="cursor-pointer"
        >
          {children}
        </span>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-0 overflow-hidden shadow-lg"
        sideOffset={6}
        onMouseEnter={() => {
          if (openTimer.current) clearTimeout(openTimer.current)
        }}
        onMouseLeave={() => setOpen(false)}
      >
        <div className="p-4">
          {/* Header */}
          <div className="flex items-start gap-3">
            <Avatar className="h-12 w-12 shrink-0">
              <AvatarImage src={avatarSrc} alt={displayName} />
              <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">
                {displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Link
                  href={shopProfilePath}
                  className="font-semibold text-foreground text-sm hover:underline truncate"
                >
                  {displayName}
                </Link>
                {seller?.shop_verified && (
                  <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] px-1.5 py-0 h-4">
                    ✓
                  </Badge>
                )}
              </div>
              {location && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                  <MapPin className="h-3 w-3 shrink-0" />
                  {location}
                </div>
              )}
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                {reviews.count > 0 && (
                  <span className="flex items-center gap-0.5">
                    <Star className="h-3 w-3 fill-accent text-accent" />
                    {reviews.avg.toFixed(1)} · {reviews.count}
                  </span>
                )}
                <span className="flex items-center gap-0.5">
                  <Package className="h-3 w-3" />
                  {listings.length > 0
                    ? `${listings.length}+ listings`
                    : "Seller"}
                </span>
              </div>
              {seller?.created_at && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Member since{" "}
                  {new Date(seller.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              )}
            </div>
          </div>

          {/* Follow + View shop */}
          <div className="flex gap-2 mt-3">
            <FollowButton
              sellerId={sellerId}
              sellerSlug={seller?.seller_slug ?? sellerSlugProp}
              sellerName={displayName}
              sellerCity={location}
              initialFollowing={following}
              initialFollowerCount={followerCount}
              isLoggedIn={isLoggedIn}
              isOwnProfile={isOwnProfile}
              size="sm"
              className="flex-1"
            />
            <Button variant="outline" size="sm" asChild className="flex-1">
              <Link href={shopProfilePath}>
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                View shop
              </Link>
            </Button>
          </div>
        </div>

        {/* Recent listings thumbnails */}
        {listings.length > 0 && (
          <div className="border-t border-border px-4 pb-4 pt-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">Recent listings</p>
            <div className="grid grid-cols-3 gap-1.5">
              {listings.map((listing) => {
                const img =
                  listing.listing_images?.find((i) => i.is_primary) ||
                  listing.listing_images?.[0]
                return (
                  <Link
                    key={listing.id}
                    href={getListingHref(listing)}
                    className="group relative aspect-square rounded-md overflow-hidden bg-muted block"
                    title={listing.title}
                  >
                    {img?.url ? (
                      <Image
                        src={img.url}
                        alt={listing.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-200"
                        sizes="72px"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-[10px]">
                        No img
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-black/50 px-1 py-0.5 text-[10px] text-white font-medium truncate">
                      ${Number(listing.price).toFixed(0)}
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
