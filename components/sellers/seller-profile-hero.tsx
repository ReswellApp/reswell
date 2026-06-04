"use client"

import Link from "next/link"
import { SellersBreadcrumbs } from "@/components/sellers/sellers-breadcrumbs"
import { formatDistanceToNow } from "date-fns"
import { Globe, MessageSquare, Phone } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { VerifiedBadge } from "@/components/verified-badge"
import { FollowButton } from "@/components/follows/follow-button"
import { SellerRatingStarRow } from "@/components/seller-rating-stars"
import { ShareButton } from "@/components/share-button"
import {
  SELLER_PROFILE_BANNER_DEFAULT,
} from "@/lib/brand-colors"
import {
  sellerProfileBannerClassName,
  sellerProfileShellClassName,
} from "@/lib/sellers/seller-profile-layout"
import {
  resolveSellerProfileDisplayImageUrl,
  type ListingImageSourcePick,
} from "@/lib/sellers/profile-display-image"
import { cn } from "@/lib/utils"

export type SellerProfileHeroShop = {
  id: string
  seller_slug: string
  display_name: string | null
  avatar_url: string | null
  city: string | null
  bio: string | null
  created_at: string
  last_active_at?: string | null
  is_shop: boolean | null
  shop_name: string | null
  shop_description: string | null
  shop_banner_url: string | null
  shop_logo_url: string | null
  shop_verified: boolean | null
  shop_website: string | null
  shop_phone: string | null
  shop_address: string | null
  sales_count: number | null
}

export type SellerProfileTab = "listings" | "about" | "sold"

type SellerProfileHeroProps = {
  shop: SellerProfileHeroShop
  displayName: string | null | undefined
  isShop: boolean | null | undefined
  avgRating: number
  reviewCount: number
  currentListingCount: number
  followerCount: number
  followingCount: number | null
  isFollowing: boolean
  isOwnProfile: boolean
  isLoggedIn: boolean
  activeTab: SellerProfileTab
  onTabChange: (tab: SellerProfileTab) => void
  soldCount: number
  /** Active and sold listings used when profile photo / shop logo are missing. */
  listingImageFallbacks?: ListingImageSourcePick[]
}

function StatColumn({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-0 text-center sm:text-right">
      <p className="text-sm font-bold tabular-nums text-white sm:text-lg lg:text-xl">
        {value.toLocaleString()}
      </p>
      <p className="text-[10px] font-medium leading-tight text-white/80 sm:text-xs">{label}</p>
    </div>
  )
}

function ProfileTabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-full px-2 py-1.5 text-xs font-semibold transition-colors sm:w-auto sm:px-4 sm:text-sm",
        active
          ? "bg-white text-foreground shadow-sm"
          : "text-white/90 hover:bg-white/15 hover:text-white",
      )}
    >
      {children}
    </button>
  )
}

function formatLastActive(lastActiveAt: string | null | undefined): string | null {
  if (!lastActiveAt?.trim()) return null
  const date = new Date(lastActiveAt)
  if (Number.isNaN(date.getTime())) return null
  return `Active ${formatDistanceToNow(date, { addSuffix: true })}`
}

export function SellerProfileHero({
  shop,
  displayName,
  isShop,
  avgRating,
  reviewCount,
  currentListingCount,
  followerCount,
  followingCount,
  isFollowing,
  isOwnProfile,
  isLoggedIn,
  activeTab,
  onTabChange,
  soldCount,
  listingImageFallbacks,
}: SellerProfileHeroProps) {
  const avatarSrc = resolveSellerProfileDisplayImageUrl(
    {
      is_shop: isShop,
      shop_logo_url: shop.shop_logo_url,
      avatar_url: shop.avatar_url,
    },
    listingImageFallbacks,
  )
  const lastActiveLabel = formatLastActive(shop.last_active_at)
  const handle = shop.seller_slug ? `@${shop.seller_slug}` : null
  return (
    <>
      <div className="border-b border-border/80 bg-background">
        <div className={cn(sellerProfileShellClassName, "px-4 py-3 sm:px-6 sm:py-4")}>
          <SellersBreadcrumbs sellerName={displayName ?? "Seller"} className="min-w-0 max-w-full" />
        </div>
      </div>

      <div className={cn(sellerProfileShellClassName, "pb-6 pt-3 sm:pb-10 sm:pt-4")}>
        <div
          className={sellerProfileBannerClassName}
          style={{ backgroundColor: SELLER_PROFILE_BANNER_DEFAULT }}
        >
          <div className="relative flex min-h-[inherit] flex-col justify-end px-4 pb-4 pt-4 sm:px-6 sm:pb-5 sm:pt-5 lg:px-8 lg:pb-6 lg:pt-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-4 lg:gap-5">
              <div className="flex w-full min-w-0 items-start justify-between gap-3 sm:w-auto sm:shrink-0 sm:flex-col sm:items-start sm:justify-start sm:gap-2">
                <Avatar className="h-16 w-16 shrink-0 border-4 border-white shadow-md sm:h-24 sm:w-24 lg:h-28 lg:w-28">
                  <AvatarImage src={avatarSrc} alt="" />
                  <AvatarFallback className="bg-white text-lg font-semibold text-[#5574AD] sm:text-xl">
                    {displayName?.charAt(0).toUpperCase() || "S"}
                  </AvatarFallback>
                </Avatar>
                {lastActiveLabel ? (
                  <p className="hidden text-xs font-medium text-white/80 sm:block">{lastActiveLabel}</p>
                ) : null}
                <div className="flex shrink-0 items-start gap-2.5 sm:hidden">
                  <StatColumn value={currentListingCount} label="Listings" />
                  <StatColumn value={followerCount} label="Followers" />
                  {followingCount != null ? (
                    <StatColumn value={followingCount} label="Following" />
                  ) : (
                    <StatColumn value={soldCount} label="Sold" />
                  )}
                </div>
              </div>

              <div className="min-w-0 flex-1 pb-0.5 sm:pr-36 lg:pr-44">
                {lastActiveLabel ? (
                  <p className="mb-1 text-xs font-medium text-white/80 sm:hidden">{lastActiveLabel}</p>
                ) : null}

                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg font-bold tracking-tight text-white sm:text-2xl lg:text-3xl">
                    {displayName}
                  </h1>
                  {shop.shop_verified ? (
                    <VerifiedBadge size="lg" className="fill-white text-[#7F9DD5]" />
                  ) : null}
                </div>

                {handle ? <p className="mt-0.5 truncate text-sm font-medium text-white/85">{handle}</p> : null}

                {reviewCount > 0 ? (
                  <div
                    className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white"
                    role="img"
                    aria-label={`Average ${avgRating.toFixed(1)} out of 5 stars from ${reviewCount} reviews`}
                  >
                    <SellerRatingStarRow value={avgRating} size="sm" />
                    <span className="font-semibold tabular-nums">({reviewCount})</span>
                  </div>
                ) : null}

                <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-4">
                  {!isOwnProfile ? (
                    <>
                      <FollowButton
                        sellerId={shop.id}
                        sellerName={displayName ?? undefined}
                        sellerSlug={shop.seller_slug || undefined}
                        sellerCity={shop.city || undefined}
                        initialFollowing={isFollowing}
                        initialFollowerCount={followerCount}
                        isLoggedIn={isLoggedIn}
                        size="sm"
                        appearance="profileHero"
                      />
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-9 w-9 rounded-full border-white/30 bg-white/15 text-white hover:bg-white/25 hover:text-white"
                        asChild
                      >
                        <Link href={`/messages?seller=${shop.id}`} aria-label="Message seller">
                          <MessageSquare className="h-4 w-4" />
                        </Link>
                      </Button>
                    </>
                  ) : null}
                  {shop.shop_website ? (
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-9 w-9 rounded-full border-white/30 bg-white/15 text-white hover:bg-white/25 hover:text-white"
                      asChild
                    >
                      <a href={shop.shop_website} target="_blank" rel="noopener noreferrer" aria-label="Visit website">
                        <Globe className="h-4 w-4" />
                      </a>
                    </Button>
                  ) : null}
                  {shop.shop_phone ? (
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-9 w-9 rounded-full border-white/30 bg-white/15 text-white hover:bg-white/25 hover:text-white"
                      asChild
                    >
                      <a href={`tel:${shop.shop_phone}`} aria-label="Call seller">
                        <Phone className="h-4 w-4" />
                      </a>
                    </Button>
                  ) : null}
                  <ShareButton
                    title={displayName ?? "Seller profile"}
                    className="h-9 w-9 rounded-full border-white/30 bg-white/15 text-white hover:bg-white/25 hover:text-white"
                    iconClassName="h-4 w-4"
                  />
                </div>

                <div className="mt-3 grid w-full grid-cols-3 gap-1 rounded-full bg-black/10 p-1 sm:mt-4 sm:max-w-xs">
                  <ProfileTabButton active={activeTab === "listings"} onClick={() => onTabChange("listings")}>
                    Listings
                  </ProfileTabButton>
                  <ProfileTabButton active={activeTab === "about"} onClick={() => onTabChange("about")}>
                    About
                  </ProfileTabButton>
                  <ProfileTabButton active={activeTab === "sold"} onClick={() => onTabChange("sold")}>
                    Sold
                  </ProfileTabButton>
                </div>
              </div>

              <div className="absolute right-4 top-4 hidden items-start gap-5 sm:flex lg:gap-8">
                <StatColumn value={currentListingCount} label="Listings" />
                <StatColumn value={followerCount} label="Followers" />
                {followingCount != null ? (
                  <StatColumn value={followingCount} label="Following" />
                ) : (
                  <StatColumn value={soldCount} label="Sold" />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
