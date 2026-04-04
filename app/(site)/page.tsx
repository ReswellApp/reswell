import Link from "next/link"
import Image from "next/image"
import { wideShimmer, portraitShimmer, squareShimmer } from "@/lib/image-shimmer"
import { HeroSlideshow } from "@/components/hero-slideshow"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  capitalizeWords,
  formatCategory,
  formatListingTileCategoryPillText,
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
import { ListingTile } from "@/components/listing-tile"
import { ListingTileCategoryPill } from "@/components/listing-tile-category-pill"
import { VerifiedBadge } from "@/components/verified-badge"
import { listingProductCardClassName, listingProductCardGridClassName } from "@/lib/listing-card-styles"
import { cn } from "@/lib/utils"
import { boardsBrowseLinkPrefetch } from "@/lib/boards-link-prefetch"
import { FadeInSection } from "@/components/fade-in-section"
import type { ReactNode } from "react"

const PLACEHOLDER_IMAGE = "/placeholder.svg"

/** Single-row horizontal scroll for homepage listing sections (up to 20 cards). */
function HomeListingScrollRow({
  children,
  uniformCardHeights,
}: {
  children: ReactNode
  /** Stretch all cards to the row height (surfboards, Featured Used Gear, Browse by Category). */
  uniformCardHeights?: boolean
}) {
  return (
    <div className="-mx-4 overflow-x-auto overflow-y-visible pb-2 pl-4 sm:-mx-6 sm:pl-6 lg:-mx-8 lg:pl-8 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div
        className={cn(
          "flex w-max gap-3 pr-4 sm:pr-6 lg:pr-8 snap-x snap-proximity sm:snap-none",
          uniformCardHeights && "min-h-0 items-stretch",
        )}
      >
        {children}
      </div>
    </div>
  )
}

/** ~2 full cards + peek of 3rd on mobile; fixed width from `sm` up. */
const homeListingScrollCardClass = cn(
  listingProductCardGridClassName,
  "shrink-0 snap-start w-[calc((100vw-1rem-2.25rem)/2.25)] sm:w-52",
)

const homeListingScrollImageSizes = "(max-width: 639px) 44vw, 208px"

/** Equal row height + meta pinned to bottom so price/location align across cards. */
const homeListingScrollLinkClass = "min-w-0 flex flex-1 flex-col min-h-0"
const homeListingScrollBodyClass = "min-w-0 p-3 flex flex-col flex-1 min-h-0"

/**
 * flex-1 + overflow hidden so line-clamp works; flex row stretches cards so prices align.
 * Mobile: line-clamp with ellipsis (narrow cards get 4 lines, sm+ wider cards use 3).
 */
const homeListingScrollTitleSlotClass =
  "flex min-h-0 flex-1 flex-col overflow-hidden"

const homeListingScrollHeadingClass =
  "text-sm font-medium leading-snug line-clamp-4 break-words sm:line-clamp-3"

/** Mobile: fixed band under price for row alignment; clip with line-clamp (no nested vertical scroll). Pair with `mt-1`. */
const homeListingScrollMetaLinesClass =
  "max-sm:h-[2.625rem] max-sm:max-h-[2.625rem] max-sm:overflow-hidden max-sm:min-h-0 sm:max-h-none sm:overflow-visible"

const homeListingScrollMetaFooterClass = "w-full shrink-0 pt-1"

/** Equal-height cards: surfboards row, Featured Used Gear, Browse by Category (fixed title band, flex stretch). */
const homeUniformScrollCardClass = cn(
  listingProductCardGridClassName,
  "h-full min-h-0 shrink-0 snap-start self-stretch w-[calc((100vw-1rem-2.25rem)/2.25)] sm:w-52",
)
const homeUniformScrollLinkClass =
  "flex min-h-0 h-full min-w-0 flex-1 flex-col"
const homeUniformScrollBodyClass =
  "flex min-h-0 min-w-0 flex-1 flex-col p-3 pt-3"
const homeUniformScrollTitleSlotClass =
  "flex h-[6.25rem] max-h-[6.25rem] min-h-0 shrink-0 flex-col overflow-hidden sm:h-[5.75rem] sm:max-h-[5.75rem]"
const homeUniformScrollMetaFooterClass = "mt-auto w-full shrink-0 pt-1"

/** Browse by Category: same bottom height as the Browse button on placeholder cards. */
const homeUniformCategoryBrowseSlotClass =
  "flex min-h-9 shrink-0 items-center px-3 pb-3 pt-0"

/**
 * Browse by Category seller + badge row: fixed height on all breakpoints so used (multi-line seller)
 * matches surfboard cards (mobile used `homeListingScrollMetaLinesClass` only; sm+ was unbounded).
 */
const homeBrowseCategoryMetaLinesClass =
  "h-[2.625rem] max-h-[2.625rem] min-h-0 overflow-hidden sm:h-[2.75rem] sm:max-h-[2.75rem]"

function HomeListingTitleSlot({ children }: { children: ReactNode }) {
  return <div className={homeListingScrollTitleSlotClass}>{children}</div>
}

function listingCardSrc(url?: string | null): string {
  const u = typeof url === "string" ? url.trim() : ""
  return u || PLACEHOLDER_IMAGE
}

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

/** Match `used-gear-listings` / seller grids: primary flag first, else first image. */
function primaryListingImageUrl(
  images?:
    | {
        url: string
        thumbnail_url?: string | null
        is_primary?: boolean | null
        sort_order?: number | null
      }[]
    | null
): string | undefined {
  if (!images?.length) return undefined
  const flagged = images.find((img) => img.is_primary)
  const pick =
    flagged ||
    [...images].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0]
  if (!pick?.url) return undefined
  const thumb = pick.thumbnail_url?.trim()
  return thumb || pick.url
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
      listing_images (url, thumbnail_url, sort_order, is_primary),
      profiles (display_name, avatar_url, sales_count, shop_verified),
      categories (name)
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
        .slice(0, 20)
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
      listing_images (url, thumbnail_url, sort_order, is_primary),
      profiles (display_name, avatar_url, location, sales_count, shop_verified),
      categories (name)
    `)
    .eq("status", "active")
    .eq("section", "surfboards")
    .order("created_at", { ascending: false })
    .limit(20)

  const featuredBoards = rawFeaturedBoards
    ? [...rawFeaturedBoards]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 20)
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
    .limit(48)

  const verifiedProfileIds = (recentVerifiedProfiles ?? []).map((p) => p.id)
  type ListingRow = NonNullable<typeof rawFeaturedBoards>[number]
  let verifiedSpotlight: { profile: NonNullable<typeof recentVerifiedProfiles>[number]; listing: ListingRow }[] = []

  if (verifiedProfileIds.length > 0) {
    const { data: listingsForVerified } = await supabase
      .from("listings")
      .select(
        `
        *,
        listing_images (url, thumbnail_url, sort_order, is_primary),
        profiles (display_name, avatar_url, sales_count, shop_verified),
        categories (name)
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
        if (verifiedSpotlight.length >= 20) break
      }
    }
  }

  // Fetch one recent listing per homepage category
  const { data: allCategoryListings } = await supabase
    .from("listings")
    .select(`
      *,
      listing_images (url, thumbnail_url, sort_order, is_primary),
      categories (slug, name),
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
        {/* CLS-FIX: hero has explicit min-height so the section never reflows
            while the slideshow images decode or fonts swap in. */}
        <section className="relative min-h-[420px] sm:min-h-[480px] md:min-h-[540px] flex items-center overflow-hidden">
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

        {/* Featured Surfboards */}
        {featuredBoards && featuredBoards.length > 0 && (
          <FadeInSection>
          <section className="py-16">
            <div className="container mx-auto">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold">Recently added surfboards</h2>
                  <p className="text-muted-foreground">In-person pickup only</p>
                </div>
                <Button variant="outline" asChild>
                  <Link href="/boards" prefetch={boardsBrowseLinkPrefetch("/boards")}>
                    Find More
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <HomeListingScrollRow uniformCardHeights>
                {featuredBoards.map((board) => (
                  <ListingTile
                    key={board.id}
                    href={`/boards/${board.slug || board.id}`}
                    listingId={board.id}
                    title={board.title}
                    imageAlt={capitalizeWords(board.title)}
                    listingImages={board.listing_images}
                    price={Number(board.price)}
                    linkLayout="unified"
                    linkClassName={homeUniformScrollLinkClass}
                    cardClassName={homeUniformScrollCardClass}
                    cardContentClassName={homeUniformScrollBodyClass}
                    imageSizes={homeListingScrollImageSizes}
                    blurDataURL={portraitShimmer}
                    titleSlot={
                      <div className={homeUniformScrollTitleSlotClass}>
                        <h3 className={homeListingScrollHeadingClass}>
                          {capitalizeWords(board.title)}
                        </h3>
                      </div>
                    }
                    footerSlot={
                      <div className={homeUniformScrollMetaFooterClass}>
                        <p className="text-base font-bold text-black dark:text-white">
                          ${board.price.toFixed(2)}
                        </p>
                        <div className="mt-1 flex justify-end">
                          <ListingTileCategoryPill label={formatListingTileCategoryPillText(board)} />
                        </div>
                      </div>
                    }
                    favorites={{
                      initialFavorited: favoritedIds.includes(board.id),
                      isLoggedIn: !!user,
                    }}
                  />
                ))}
              </HomeListingScrollRow>
            </div>
          </section>
          </FadeInSection>
        )}

        {/* Features CTA */}
        <section className="py-8">
          <div className="container mx-auto">
            <Link href="/sell" className="no-underline hover:no-underline flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 rounded-2xl bg-primary/5 px-8 py-8 transition-colors hover:bg-primary/10">
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

        {/* Featured Used Gear */}
        {featuredUsed && featuredUsed.length > 0 && (
          <FadeInSection>
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
              <HomeListingScrollRow uniformCardHeights>
                {featuredUsed.map((listing) => (
                  <ListingTile
                    key={listing.id}
                    href={`/used/${listing.slug || listing.id}`}
                    listingId={listing.id}
                    title={listing.title}
                    imageAlt={capitalizeWords(listing.title)}
                    listingImages={listing.listing_images}
                    price={Number(listing.price)}
                    linkLayout="unified"
                    linkClassName={homeUniformScrollLinkClass}
                    cardClassName={homeUniformScrollCardClass}
                    cardContentClassName={homeUniformScrollBodyClass}
                    imageSizes={homeListingScrollImageSizes}
                    blurDataURL={portraitShimmer}
                    titleSlot={
                      <div className={homeUniformScrollTitleSlotClass}>
                        <h3 className={homeListingScrollHeadingClass}>
                          {capitalizeWords(listing.title)}
                        </h3>
                      </div>
                    }
                    footerSlot={
                      <div className={homeUniformScrollMetaFooterClass}>
                        <p className="text-base font-bold text-black dark:text-white">
                          ${listing.price.toFixed(2)}
                        </p>
                        <div
                          className={`mt-1 flex items-start justify-between gap-1 text-xs text-muted-foreground ${homeListingScrollMetaLinesClass}`}
                        >
                          <div className="flex min-w-0 flex-1 items-start gap-1">
                            <span className="min-w-0 flex-1 break-words line-clamp-2 leading-snug">
                              {getPublicSellerDisplayName(listing.profiles)}
                            </span>
                            {listing.profiles?.shop_verified && (
                              <VerifiedBadge size="sm" className="mt-0.5 shrink-0" />
                            )}
                          </div>
                          <ListingTileCategoryPill label={formatListingTileCategoryPillText(listing)} />
                        </div>
                      </div>
                    }
                    favorites={{
                      initialFavorited: favoritedIds.includes(listing.id),
                      isLoggedIn: !!user,
                    }}
                  />
                ))}
              </HomeListingScrollRow>
            </div>
          </section>
          </FadeInSection>
        )}

        {/* Confidence banner */}
        <section className="py-8">
          <div className="container mx-auto">
            <Link href="/contact" className="no-underline hover:no-underline flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 rounded-2xl bg-primary/5 px-8 py-8 transition-colors hover:bg-primary/10">
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
          <FadeInSection>
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
              <HomeListingScrollRow>
                {verifiedSpotlight.map(({ profile, listing }) => {
                  const href = listingPublicHref(listing)
                  const sellerLabel =
                    profile.shop_name?.trim() || getPublicSellerDisplayName(profile)
                  return (
                    <ListingTile
                      key={`${profile.id}-${listing.id}`}
                      href={href}
                      listingId={listing.id}
                      title={listing.title}
                      imageAlt={capitalizeWords(listing.title)}
                      listingImages={listing.listing_images}
                      price={Number(listing.price)}
                      linkLayout="unified"
                      linkClassName={homeListingScrollLinkClass}
                      cardClassName={homeListingScrollCardClass}
                      cardContentClassName={homeListingScrollBodyClass}
                      imageSizes={homeListingScrollImageSizes}
                      blurDataURL={portraitShimmer}
                      titleSlot={
                        <HomeListingTitleSlot>
                          <h3 className={homeListingScrollHeadingClass}>
                            {capitalizeWords(listing.title)}
                          </h3>
                        </HomeListingTitleSlot>
                      }
                      footerSlot={
                        <div className={homeListingScrollMetaFooterClass}>
                          <p className="text-base font-bold text-black dark:text-white">
                            ${Number(listing.price).toFixed(2)}
                          </p>
                          <div className="mt-1 flex justify-end">
                            <ListingTileCategoryPill label={formatListingTileCategoryPillText(listing)} />
                          </div>
                        </div>
                      }
                      favorites={{
                        initialFavorited: favoritedIds.includes(listing.id),
                        isLoggedIn: !!user,
                      }}
                      trailingInsideCard={
                        <div className="shrink-0 border-t border-border/60 bg-muted/40 px-3 py-2">
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
                      }
                    />
                  )
                })}
              </HomeListingScrollRow>
            </div>
          </section>
          </FadeInSection>
        )}

        {/* CTA */}
        <section className="py-8">
          <div className="container mx-auto">
            <Link href="/auth/sign-up" className="no-underline hover:no-underline flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 rounded-2xl bg-primary/5 px-8 py-8 transition-colors hover:bg-primary/10">
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
        <FadeInSection>
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
            <HomeListingScrollRow uniformCardHeights>
              {categories.map((category) => {
                const listing = categoryLatest.get(category.name)

                if (!listing) {
                  return (
                    <Card key={category.href} className={homeUniformScrollCardClass}>
                      <Link
                        href={category.href}
                        prefetch={boardsBrowseLinkPrefetch(category.href)}
                        className={homeUniformScrollLinkClass}
                      >
                        <div className="relative aspect-[3/4] w-full shrink-0 bg-muted overflow-hidden">
                          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                            No Image
                          </div>
                        </div>
                        <CardContent className={homeUniformScrollBodyClass}>
                          <div className={homeUniformScrollTitleSlotClass}>
                            <h3 className={homeListingScrollHeadingClass}>{category.name}</h3>
                          </div>
                          <div className={homeUniformScrollMetaFooterClass}>
                            <p
                              className="text-base font-bold text-black dark:text-white invisible select-none pointer-events-none"
                              aria-hidden
                            >
                              $0.00
                            </p>
                            <div
                              className={`mt-1 flex items-start justify-between gap-1 ${homeBrowseCategoryMetaLinesClass}`}
                            >
                              <div className="flex min-h-0 min-w-0 flex-1 items-start gap-1 overflow-hidden">
                                <span className="invisible line-clamp-2 text-xs leading-snug" aria-hidden>
                                  &nbsp;
                                </span>
                              </div>
                              <ListingTileCategoryPill label={formatCategory(category.name)} />
                            </div>
                          </div>
                        </CardContent>
                      </Link>
                      <div className={homeUniformCategoryBrowseSlotClass}>
                        <Button variant="outline" size="sm" className="bg-transparent" asChild>
                          <Link href={category.href} prefetch={boardsBrowseLinkPrefetch(category.href)}>
                            Browse
                          </Link>
                        </Button>
                      </div>
                    </Card>
                  )
                }

                const href = listingPublicHref(listing)
                const showBoardLength = listing.section === "surfboards"

                return (
                  <ListingTile
                    key={category.href}
                    href={href}
                    listingId={listing.id}
                    title={listing.title}
                    imageAlt={capitalizeWords(listing.title)}
                    listingImages={listing.listing_images}
                    price={Number(listing.price)}
                    linkLayout="unified"
                    linkClassName={homeUniformScrollLinkClass}
                    cardClassName={homeUniformScrollCardClass}
                    cardContentClassName={homeUniformScrollBodyClass}
                    imageSizes={homeListingScrollImageSizes}
                    blurDataURL={portraitShimmer}
                    titleSlot={
                      <div className={homeUniformScrollTitleSlotClass}>
                        <h3 className={homeListingScrollHeadingClass}>
                          {capitalizeWords(listing.title)}
                        </h3>
                        {showBoardLength ? (
                          <p
                            className={`mt-0.5 text-xs text-muted-foreground line-clamp-1 break-words ${listing.board_length ? "" : "invisible"}`}
                            aria-hidden={!listing.board_length}
                          >
                            {listing.board_length ?? "\u00a0"}
                          </p>
                        ) : null}
                      </div>
                    }
                    footerSlot={
                      <div className={homeUniformScrollMetaFooterClass}>
                        <p className="text-base font-bold text-black dark:text-white">
                          ${Number(listing.price).toFixed(2)}
                        </p>
                        <div
                          className={`mt-1 flex items-start justify-between gap-1 ${homeBrowseCategoryMetaLinesClass}`}
                        >
                          <div className="flex min-h-0 min-w-0 flex-1 items-start gap-1 overflow-hidden">
                            <span className="min-w-0 flex-1 break-words text-xs text-muted-foreground line-clamp-2 leading-snug">
                              {getPublicSellerDisplayName(listing.profiles)}
                            </span>
                            {listing.profiles?.shop_verified && (
                              <VerifiedBadge size="sm" className="mt-0.5 shrink-0" />
                            )}
                          </div>
                          <ListingTileCategoryPill
                            label={formatListingTileCategoryPillText(listing) ?? formatCategory(category.name)}
                          />
                        </div>
                      </div>
                    }
                    favorites={{
                      initialFavorited: favoritedIds.includes(listing.id),
                      isLoggedIn: !!user,
                    }}
                    trailingInsideCard={<div className={homeUniformCategoryBrowseSlotClass} aria-hidden />}
                  />
                )
              })}
            </HomeListingScrollRow>
          </div>
        </section>
        </FadeInSection>

        {/* Featured Sellers */}
        {featuredShops && featuredShops.length > 0 && (
          <FadeInSection>
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
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {featuredShops.map((shop) => (
                  <Link key={shop.id} href={`/sellers/${shop.id}`}>
                    <Card className={cn(listingProductCardClassName, "h-full")}>
                      <div className="h-20 bg-offwhite relative overflow-hidden">
                        {shop.shop_banner_url && (
                          <Image
                            src={shop.shop_banner_url}
                            alt=""
                            fill
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                            className="object-cover"
                            placeholder="blur"
                            blurDataURL={wideShimmer}
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
          </FadeInSection>
        )}

        {/* Featured New Gear */}
        {featuredNew && featuredNew.length > 0 && (
          <FadeInSection>
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
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {featuredNew.map((item) => (
                  <Link key={item.id} href={`/shop/${item.id}`}>
                    <Card className={listingProductCardClassName}>
                      <div className="aspect-square relative bg-muted">
                        <Image
                          src={listingCardSrc(item.image_url)}
                          alt={item.name}
                          fill
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                          className="object-contain group-hover:scale-105 transition-transform duration-300"
                          placeholder="blur"
                          blurDataURL={squareShimmer}
                        />
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
          </FadeInSection>
        )}

      </main>
  )
}
