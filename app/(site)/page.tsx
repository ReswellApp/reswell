import Link from "next/link"
import Image from "next/image"
import { HeroSlideshow } from "@/components/hero-slideshow"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  capitalizeWords,
  formatCategory,
  getPublicSellerDisplayName,
} from "@/lib/listing-labels"
import { createClient } from "@/lib/supabase/server"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  ArrowRight,
  MapPin,
  Shield,
  MessageSquare,
  Recycle,
  Users,
  Store,
  UserCheck,
} from "lucide-react"
import { MessageListingButton } from "@/components/message-listing-button"
import { FavoriteButtonCardOverlay } from "@/components/favorite-button-card-overlay"
import { VerifiedBadge } from "@/components/verified-badge"

const categories = [
  { name: "Surfboards", href: "/boards", section: "surfboards", slug: null },
  { name: "Wetsuits", href: "/used/wetsuits", section: "used", slug: "wetsuits" },
  { name: "Apparel & Lifestyle", href: "/used/apparel-lifestyle", section: "used", slug: "apparel-lifestyle" },
  { name: "Fins", href: "/used/fins", section: "used", slug: "fins" },
  { name: "Leashes", href: "/used/leashes", section: "used", slug: "leashes" },
  { name: "Board Bags", href: "/used/board-bags", section: "used", slug: "board-bags" },
  { name: "Vintage", href: "/used/collectibles-vintage", section: "used", slug: "collectibles-vintage" },
]

function listingPublicHref(listing: {
  id: string
  slug?: string | null
  section: string
}): string {
  const slugOrId = listing.slug || listing.id
  if (listing.section === "surfboards") return `/boards/${slugOrId}`
  if (listing.section === "new") return `/shop/${listing.id}`
  return `/used/${slugOrId}`
}

function primaryImageUrl(
  images?: { url: string; sort_order?: number | null }[] | null
): string | undefined {
  if (!images || images.length === 0) return undefined
  const sorted = [...images].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  )
  return sorted[0].url
}

/** Match `used-gear-listings` / seller grids: primary flag first, else first image. */
function primaryListingImageUrl(
  images?:
    | { url: string; is_primary?: boolean | null; sort_order?: number | null }[]
    | null
): string | undefined {
  if (!images?.length) return undefined
  const flagged = images.find((img) => img.is_primary)
  if (flagged?.url) return flagged.url
  return images[0]?.url
}

const features = [
  {
    icon: Recycle,
    title: "Sustainable Surfing",
    description: "Give your gear a second life and reduce waste in the surfing community.",
  },
  {
    icon: Shield,
    title: "Secure Transactions",
    description: "Protected payments and verified sellers for peace of mind.",
  },
  {
    icon: MessageSquare,
    title: "Direct Communication",
    description: "Chat directly with buyers and sellers to ask questions and negotiate.",
  },
  {
    icon: MapPin,
    title: "Local Pickup",
    description: "Find surfboards near you for in-person inspection and pickup.",
  },
]

export default async function HomePage() {
  const supabase = await createClient()
  
  // Fetch featured used listings - prioritize top sellers
  const { data: rawFeaturedUsed } = await supabase
    .from("listings")
    .select(`
      *,
      listing_images (url, sort_order),
      profiles (display_name, avatar_url, sales_count, shop_verified)
    `)
    .eq("status", "active")
    .eq("section", "used")
    .order("created_at", { ascending: false })
    .limit(20)

  // Sort by seller sales_count descending, then recency, and take top 4
  const featuredUsed = rawFeaturedUsed
    ? [...rawFeaturedUsed]
        .sort((a, b) => {
          const salesA = a.profiles?.sales_count ?? 0
          const salesB = b.profiles?.sales_count ?? 0
          if (salesB !== salesA) return salesB - salesA
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        })
        .slice(0, 4)
    : null

  // Fetch featured new items
  const { data: featuredNew } = await supabase
    .from("inventory")
    .select("*")
    .eq("is_active", true)
    .gt("stock_quantity", 0)
    .order("created_at", { ascending: false })
    .limit(4)

  // Fetch featured shops - public profile fields only; never expose email or role flags
  const profilePublicFields =
    "id, display_name, avatar_url, location, city, bio, created_at, updated_at, is_shop, shop_name, shop_description, shop_banner_url, shop_logo_url, shop_verified, shop_website, shop_phone, shop_address, sales_count"
  const { data: featuredShops } = await supabase
    .from("profiles")
    .select(profilePublicFields)
    .eq("is_shop", true)
    .order("sales_count", { ascending: false })
    .order("shop_verified", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(4)

  // Fetch featured boards (in-person only) - prioritize top sellers
  const { data: rawFeaturedBoards } = await supabase
    .from("listings")
    .select(`
      *,
      listing_images (url, sort_order),
      profiles (display_name, avatar_url, location, sales_count, shop_verified)
    `)
    .eq("status", "active")
    .eq("section", "surfboards")
    .order("created_at", { ascending: false })
    .limit(20)

  const featuredBoards = rawFeaturedBoards
    ? [...rawFeaturedBoards]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 4)
    : null

  // Recently verified sellers: each card shows their single most expensive active listing + profile
  const verifiedForSpotlightFields =
    "id, display_name, avatar_url, city, is_shop, shop_name, shop_logo_url, shop_verified, shop_verified_at, updated_at"
  const { data: recentVerifiedProfiles } = await supabase
    .from("profiles")
    .select(verifiedForSpotlightFields)
    .eq("shop_verified", true)
    .order("shop_verified_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(24)

  const verifiedProfileIds = (recentVerifiedProfiles ?? []).map((p) => p.id)
  type ListingRow = NonNullable<typeof rawFeaturedBoards>[number]
  let verifiedSpotlight: { profile: NonNullable<typeof recentVerifiedProfiles>[number]; listing: ListingRow }[] = []

  if (verifiedProfileIds.length > 0) {
    const { data: listingsForVerified } = await supabase
      .from("listings")
      .select(
        `
        *,
        listing_images (url, sort_order),
        profiles (display_name, avatar_url, sales_count, shop_verified)
      `
      )
      .in("user_id", verifiedProfileIds)
      .eq("status", "active")

    const bestByUser = new Map<string, ListingRow>()
    for (const listing of (listingsForVerified ?? []) as ListingRow[]) {
      const uid = listing.user_id
      const prev = bestByUser.get(uid)
      const price = Number(listing.price)
      if (!prev || price > Number(prev.price)) {
        bestByUser.set(uid, listing)
      }
    }

    for (const profile of recentVerifiedProfiles ?? []) {
      const listing = bestByUser.get(profile.id)
      if (listing) {
        verifiedSpotlight.push({ profile, listing })
        if (verifiedSpotlight.length >= 4) break
      }
    }
  }

  // Fetch one recent listing per homepage category
  const { data: allCategoryListings } = await supabase
    .from("listings")
    .select(`
      *,
      listing_images (url, sort_order, is_primary),
      categories (slug),
      profiles (display_name, avatar_url, location, sales_count, shop_verified)
    `)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(200)

  const categoryLatest = new Map<string, NonNullable<typeof allCategoryListings>[number]>()
  for (const cat of categories) {
    const match = (allCategoryListings ?? []).find((l) => {
      if (cat.slug === null) return l.section === "surfboards"
      const catSlug = Array.isArray(l.categories) ? (l.categories as any)[0]?.slug : (l.categories as any)?.slug
      return catSlug === cat.slug
    })
    if (match) categoryLatest.set(cat.name, match)
  }

  const { data: { user } } = await supabase.auth.getUser()
  const featuredListingIds = [
    ...(featuredUsed ?? []).map((l) => l.id),
    ...(featuredBoards ?? []).map((b) => b.id),
    ...verifiedSpotlight.map(({ listing }) => listing.id),
    ...Array.from(categoryLatest.values()).map((l) => l.id),
  ]
  let favoritedIds: string[] = []
  if (user && featuredListingIds.length > 0) {
    const { data: favs } = await supabase
      .from("favorites")
      .select("listing_id")
      .eq("user_id", user.id)
      .in("listing_id", featuredListingIds)
    favoritedIds = (favs ?? []).map((f) => f.listing_id)
  }

  return (
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative min-h-[420px] md:min-h-[520px] flex items-center overflow-hidden">
          <HeroSlideshow />
          <div className="absolute inset-0 bg-white/55" aria-hidden />
          <div className="container mx-auto relative z-10 py-20 md:py-32">
            <div className="mx-auto max-w-3xl text-center">
              <Badge variant="secondary" className="mb-4 text-black">
                The Surf Community Marketplace
              </Badge>
              <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl text-balance">
                Buy and Sell Surf Gear with the Community
              </h1>
              <p className="mt-6 text-lg text-muted-foreground text-pretty">
                Join thousands of surfers buying and selling quality used gear, 
                shopping new accessories, and finding local surfboards.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button size="lg" asChild>
                  <Link href="/used">
                    Browse Used Gear
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/sell">Start Selling</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Featured Used Gear */}
        {featuredUsed && featuredUsed.length > 0 && (
          <section className="py-16">
            <div className="container mx-auto">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold">Featured Used Gear</h2>
                  <p className="text-muted-foreground">Pre-loved items from the community</p>
                </div>
                <Button variant="outline" asChild>
                  <Link href="/used">
                    View All
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {featuredUsed.map((listing) => (
                  <Card key={listing.id} className="group overflow-hidden hover:shadow-lg transition-shadow flex flex-col">
                    <Link href={`/used/${listing.slug || listing.id}`} className="flex-1 flex flex-col">
                      <div className="aspect-[4/5] relative bg-muted overflow-hidden">
                        {primaryImageUrl(listing.listing_images) ? (
                          <Image
                            src={primaryImageUrl(listing.listing_images)!}
                            alt={capitalizeWords(listing.title)}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                            style={{ objectFit: "cover" }}
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                            No Image
                          </div>
                        )}
                        <FavoriteButtonCardOverlay
                          listingId={listing.id}
                          initialFavorited={favoritedIds.includes(listing.id)}
                          isLoggedIn={!!user}
                        />
                      </div>
                      <CardContent className="p-4">
                        <h3 className="font-medium line-clamp-1">{capitalizeWords(listing.title)}</h3>
                        <p className="text-lg font-bold text-black dark:text-white mt-1">
                          ${listing.price.toFixed(2)}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                          {getPublicSellerDisplayName(listing.profiles)}
                          {listing.profiles?.shop_verified && <VerifiedBadge size="sm" />}
                        </p>
                      </CardContent>
                    </Link>
                    <div className="px-4 pb-4 pt-0">
                      <MessageListingButton
                        listingId={listing.id}
                        sellerId={listing.user_id}
                        redirectPath={`/used/${listing.slug || listing.id}`}
                      />
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Features CTA */}
        <section className="py-8">
          <div className="container mx-auto">
            <Link href="/sell" className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 rounded-2xl bg-primary/5 px-8 py-8 transition-colors hover:bg-primary/10">
              <div>
                <p className="text-lg font-semibold text-foreground">Give your gear a second life</p>
                <p className="text-muted-foreground mt-1">
                  Secure payments, verified sellers, direct messaging, shipping, and local pickup — all in one place.
                </p>
              </div>
              <span className="shrink-0 inline-flex items-center gap-2 font-medium text-foreground">
                Start selling
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          </div>
        </section>

        {/* Featured Surfboards */}
        {featuredBoards && featuredBoards.length > 0 && (
          <section className="py-16">
            <div className="container mx-auto">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold">Recently added surfboards</h2>
                  <p className="text-muted-foreground">In-person pickup only</p>
                </div>
                <Button variant="outline" asChild>
                  <Link href="/boards">
                    Find More
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {featuredBoards.map((board) => (
                  <Card key={board.id} className="group overflow-hidden hover:shadow-lg transition-shadow flex flex-col">
                    <Link href={`/boards/${board.slug || board.id}`} className="flex-1 flex flex-col">
                      <div className="aspect-[4/5] relative bg-muted overflow-hidden">
                        {primaryImageUrl(board.listing_images) ? (
                          <Image
                            src={primaryImageUrl(board.listing_images)!}
                            alt={capitalizeWords(board.title)}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                            style={{ objectFit: "cover" }}
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                            No Image
                          </div>
                        )}
                        <FavoriteButtonCardOverlay
                          listingId={board.id}
                          initialFavorited={favoritedIds.includes(board.id)}
                          isLoggedIn={!!user}
                        />
                      </div>
                      <CardContent className="p-4">
                        <h3 className="font-medium line-clamp-1">{capitalizeWords(board.title)}</h3>
                        <p className="text-lg font-bold text-black dark:text-white mt-1">
                          ${board.price.toFixed(2)}
                        </p>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {[board.city, board.state].filter(Boolean).join(", ") || "Location not set"}
                        </div>
                      </CardContent>
                    </Link>
                    <div className="px-4 pb-4 pt-0">
                      <MessageListingButton
                        listingId={board.id}
                        sellerId={board.user_id}
                        redirectPath={`/boards/${board.slug || board.id}`}
                      />
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Confidence banner */}
        <section className="py-8">
          <div className="container mx-auto">
            <Link href="/contact" className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 rounded-2xl bg-primary/5 px-8 py-8 transition-colors hover:bg-primary/10">
              <div>
                <p className="text-lg font-semibold text-foreground">Buy and sell with confidence!</p>
                <p className="text-muted-foreground mt-1">
                  All transactions on Reswell are backed by verified sellers and secure payments. Contact our support team anytime for help.
                </p>
              </div>
              <span className="shrink-0 inline-flex items-center gap-2 font-medium text-foreground">
                Contact us
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          </div>
        </section>

        {/* Recently verified sellers — top-priced listing + profile */}
        {verifiedSpotlight.length > 0 && (
          <section className="py-16 bg-offwhite">
            <div className="container mx-auto">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold">Recently verified users</h2>
                  <p className="text-muted-foreground">
                    Each seller&apos;s priciest active listing right now, with their profile below
                  </p>
                </div>
                <Button variant="outline" asChild>
                  <Link href="/sellers">
                    Browse sellers
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {verifiedSpotlight.map(({ profile, listing }) => {
                  const href = listingPublicHref(listing)
                  const sellerLabel =
                    profile.shop_name?.trim() || getPublicSellerDisplayName(profile)
                  const locationLine = [listing.city, listing.state].filter(Boolean).join(", ")
                  return (
                    <Card
                      key={`${profile.id}-${listing.id}`}
                      className="group overflow-hidden hover:shadow-lg transition-shadow flex flex-col"
                    >
                      <Link href={href} className="flex-1 flex flex-col">
                        <div className="aspect-[4/5] relative bg-muted overflow-hidden">
                          {primaryImageUrl(listing.listing_images) ? (
                            <Image
                              src={primaryImageUrl(listing.listing_images)!}
                              alt={capitalizeWords(listing.title)}
                              fill
                              className="object-cover group-hover:scale-105 transition-transform duration-300"
                              style={{ objectFit: "cover" }}
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                              No Image
                            </div>
                          )}
                          <FavoriteButtonCardOverlay
                            listingId={listing.id}
                            initialFavorited={favoritedIds.includes(listing.id)}
                            isLoggedIn={!!user}
                          />
                        </div>
                        <CardContent className="p-4">
                          <h3 className="font-medium line-clamp-1">{capitalizeWords(listing.title)}</h3>
                          <p className="text-lg font-bold text-black dark:text-white mt-1">
                            ${Number(listing.price).toFixed(2)}
                          </p>
                          {locationLine ? (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                              <MapPin className="h-3 w-3 shrink-0" />
                              {locationLine}
                            </div>
                          ) : null}
                        </CardContent>
                      </Link>
                      <div className="border-t border-border/60 bg-muted/40 px-4 py-3">
                        <Link
                          href={`/sellers/${profile.id}`}
                          className="flex items-center gap-3 rounded-md -mx-1 px-1 py-0.5 transition-colors hover:bg-muted/80"
                        >
                          <Avatar className="h-10 w-10 border border-border shrink-0">
                            <AvatarImage
                              src={profile.shop_logo_url || profile.avatar_url || ""}
                              alt=""
                            />
                            <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                              {sellerLabel.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1 text-left">
                            <p className="font-medium text-sm line-clamp-1 text-foreground">{sellerLabel}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <UserCheck className="h-3 w-3 shrink-0" />
                              Verified seller
                            </p>
                          </div>
                          <VerifiedBadge size="md" className="shrink-0" />
                        </Link>
                      </div>
                      <div className="px-4 pb-4 pt-0">
                        <MessageListingButton
                          listingId={listing.id}
                          sellerId={listing.user_id}
                          redirectPath={href}
                        />
                      </div>
                    </Card>
                  )
                })}
              </div>
            </div>
          </section>
        )}

        {/* CTA */}
        <section className="py-8">
          <div className="container mx-auto">
            <Link href="/auth/sign-up" className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 rounded-2xl bg-primary/5 px-8 py-8 transition-colors hover:bg-primary/10">
              <div>
                <p className="text-lg font-semibold text-foreground">Ready to ride the wave?</p>
                <p className="text-muted-foreground mt-1">
                  Join our community of surfers and start buying, selling, or trading today.
                </p>
              </div>
              <span className="shrink-0 inline-flex items-center gap-2 font-medium text-foreground">
                Create account
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          </div>
        </section>

        {/* Categories */}
        <section className="py-16 bg-offwhite">
          <div className="container mx-auto">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold">Browse by Category</h2>
              <Button variant="ghost" asChild>
                <Link href="/used">
                  View All
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {categories.map((category) => {
                const listing = categoryLatest.get(category.name)
                const isBoardsCategory = category.slug === null

                if (!listing) {
                  return (
                    <Card
                      key={category.href}
                      className="group overflow-hidden hover:shadow-lg transition-shadow h-full flex flex-col"
                    >
                      <Link href={category.href} className="flex-1 flex flex-col">
                        <div className="relative aspect-[4/5] bg-muted overflow-hidden">
                          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                            No Image
                          </div>
                        </div>
                        <CardContent className="p-4">
                          <h3 className="font-medium line-clamp-2">{category.name}</h3>
                          <p
                            className="text-xl font-bold text-black dark:text-white mt-2 invisible select-none pointer-events-none"
                            aria-hidden
                          >
                            $0.00
                          </p>
                          {isBoardsCategory ? (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-2">
                              <MapPin className="h-3 w-3" />
                              Location not set
                            </div>
                          ) : (
                            <div className="flex items-center justify-between mt-2">
                              <p
                                className="text-sm text-muted-foreground flex items-center gap-1 invisible"
                                aria-hidden
                              >
                                .
                              </p>
                              <Badge variant="outline" className="text-xs">
                                {formatCategory(category.name)}
                              </Badge>
                            </div>
                          )}
                        </CardContent>
                      </Link>
                      <div className="px-4 pb-4 pt-0">
                        <Button variant="outline" size="sm" className="bg-transparent" asChild>
                          <Link href={category.href}>Browse</Link>
                        </Button>
                      </div>
                    </Card>
                  )
                }

                const href = listingPublicHref(listing)
                const imgUrl = primaryListingImageUrl(listing.listing_images)

                if (listing.section === "surfboards") {
                  const locationLine =
                    listing.city && listing.state
                      ? `${listing.city}, ${listing.state}`
                      : listing.profiles?.location || "Location not set"
                  return (
                    <Card
                      key={category.href}
                      className="group overflow-hidden hover:shadow-lg transition-shadow h-full flex flex-col"
                    >
                      <Link href={href} className="flex-1 flex flex-col">
                        <div className="aspect-[4/5] relative bg-muted overflow-hidden">
                          {imgUrl ? (
                            <Image
                              src={imgUrl || "/placeholder.svg"}
                              alt={capitalizeWords(listing.title)}
                              fill
                              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                              className="object-cover group-hover:scale-105 transition-transform duration-300"
                              style={{ objectFit: "cover" }}
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                              No Image
                            </div>
                          )}
                          <FavoriteButtonCardOverlay
                            listingId={listing.id}
                            initialFavorited={favoritedIds.includes(listing.id)}
                            isLoggedIn={!!user}
                          />
                        </div>
                        <CardContent className="p-4">
                          <h3 className="font-medium line-clamp-2">
                            {capitalizeWords(listing.title)}
                          </h3>
                          {listing.board_length && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {listing.board_length}
                            </p>
                          )}
                          <p className="text-xl font-bold text-black dark:text-white mt-2">
                            ${Number(listing.price).toFixed(2)}
                          </p>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground mt-2">
                            <MapPin className="h-3 w-3" />
                            {locationLine}
                          </div>
                        </CardContent>
                      </Link>
                      <div className="px-4 pb-4 pt-0">
                        <MessageListingButton
                          listingId={listing.id}
                          sellerId={listing.user_id}
                          redirectPath={href}
                        />
                      </div>
                    </Card>
                  )
                }

                return (
                  <Card
                    key={category.href}
                    className="group overflow-hidden hover:shadow-lg transition-shadow h-full flex flex-col"
                  >
                    <Link href={href} className="flex-1 flex flex-col">
                      <div className="aspect-[4/5] relative bg-muted overflow-hidden">
                        {imgUrl ? (
                          <Image
                            src={imgUrl || "/placeholder.svg"}
                            alt={capitalizeWords(listing.title)}
                            fill
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                            style={{ objectFit: "cover" }}
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                            No Image
                          </div>
                        )}
                        <FavoriteButtonCardOverlay
                          listingId={listing.id}
                          initialFavorited={favoritedIds.includes(listing.id)}
                          isLoggedIn={!!user}
                        />
                      </div>
                      <CardContent className="p-4">
                        <h3 className="font-medium line-clamp-2">
                          {capitalizeWords(listing.title)}
                        </h3>
                        <p className="text-xl font-bold text-black dark:text-white mt-2">
                          ${Number(listing.price).toFixed(2)}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            {getPublicSellerDisplayName(listing.profiles)}
                            {listing.profiles?.shop_verified && (
                              <VerifiedBadge size="sm" />
                            )}
                          </p>
                          <Badge variant="outline" className="text-xs">
                            {formatCategory(category.name)}
                          </Badge>
                        </div>
                      </CardContent>
                    </Link>
                    <div className="px-4 pb-4 pt-0">
                      <MessageListingButton
                        listingId={listing.id}
                        sellerId={listing.user_id}
                        redirectPath={href}
                      />
                    </div>
                  </Card>
                )
              })}
            </div>
          </div>
        </section>

        {/* Featured Sellers */}
        {featuredShops && featuredShops.length > 0 && (
          <section className="py-16">
            <div className="container mx-auto">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold">Featured Sellers</h2>
                  <p className="text-muted-foreground">Browse gear from local retail stores</p>
                </div>
                <Button variant="outline" asChild>
                  <Link href="/sellers">
                    All Sellers
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {featuredShops.map((shop) => (
                  <Link key={shop.id} href={`/sellers/${shop.id}`}>
                    <Card className="group overflow-hidden hover:shadow-lg transition-shadow h-full">
                      <div className="h-20 bg-offwhite relative">
                        {shop.shop_banner_url && (
                          <img
                            src={shop.shop_banner_url || "/placeholder.svg"}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                        )}
                      </div>
                      <CardContent className="p-4 pt-0">
                        <div className="flex items-end gap-3 -mt-6 mb-3">
                          <Avatar className="h-12 w-12 border-2 border-card">
                            <AvatarImage src={shop.shop_logo_url || shop.avatar_url || ""} />
                            <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                              {(shop.shop_name || shop.display_name || "S").charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          {shop.shop_verified && (
                            <VerifiedBadge size="md" className="-ml-1 mb-0.5" />
                          )}
                        </div>
                        <h3 className="font-semibold line-clamp-1 text-foreground">
                          {shop.shop_name || shop.display_name}
                        </h3>
                        {(shop.city || shop.shop_address) && (
                          <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground line-clamp-1">
                            <MapPin className="h-3 w-3 flex-shrink-0" />
                            {shop.shop_address || shop.city}
                          </p>
                        )}
                        {shop.shop_description && (
                          <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                            {shop.shop_description}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Featured New Gear */}
        {featuredNew && featuredNew.length > 0 && (
          <section className="py-16 bg-offwhite">
            <div className="container mx-auto">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold">New Arrivals</h2>
                  <p className="text-muted-foreground">Fresh gear from our store</p>
                </div>
                <Button variant="outline" asChild>
                  <Link href="/shop">
                    Shop All
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {featuredNew.map((item) => (
                  <Link key={item.id} href={`/shop/${item.id}`}>
                    <Card className="group overflow-hidden hover:shadow-lg transition-shadow">
                      <div className="aspect-square relative bg-muted">
                        {item.image_url ? (
                          <Image
                            src={item.image_url || "/placeholder.svg"}
                            alt={item.name}
                            fill
                            className="object-contain group-hover:scale-105 transition-transform duration-300"
                            style={{ objectFit: "contain" }}
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                            No Image
                          </div>
                        )}
                      </div>
                      <CardContent className="p-4">
                        <h3 className="font-medium line-clamp-1">{item.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-lg font-bold text-black dark:text-white">
                            ${item.price.toFixed(2)}
                          </p>
                          {item.compare_at_price && item.compare_at_price > item.price && (
                            <p className="text-sm text-muted-foreground line-through">
                              ${item.compare_at_price.toFixed(2)}
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

      </main>
  )
}
