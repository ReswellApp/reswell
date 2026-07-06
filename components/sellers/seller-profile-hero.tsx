"use client"

import Link from "next/link"
import { SellersBreadcrumbs } from "@/components/sellers/sellers-breadcrumbs"
import { SellerProfileBannerEditor } from "@/components/sellers/seller-profile-banner-editor"
import { SellerProfilePhotoEditor } from "@/components/sellers/seller-profile-photo-editor"
import { formatDistanceToNow } from "date-fns"
import { Globe, MapPin, MessageSquare, Phone } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ProfileAvatarImage } from "@/components/features/dashboard/profile-avatar-image"
import { Button } from "@/components/ui/button"
import { VerifiedBadge } from "@/components/verified-badge"
import { FollowButton } from "@/components/follows/follow-button"
import { SellerRatingStarRow } from "@/components/seller-rating-stars"
import { ShareButton } from "@/components/share-button"
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
  avatar_focal_x_pct?: number | null
  avatar_focal_y_pct?: number | null
  location: string | null
  city: string | null
  bio: string | null
  created_at: string
  last_active_at?: string | null
  is_shop: boolean | null
  shop_name: string | null
  shop_description: string | null
  shop_banner_url: string | null
  shop_banner_focal_x_pct?: number | null
  shop_banner_focal_y_pct?: number | null
  shop_logo_url: string | null
  shop_verified: boolean | null
  shop_website: string | null
  shop_phone: string | null
  shop_address: string | null
  sales_count: number | null
}

export type SellerProfileTab = "listings" | "feedback" | "info" | "sold"

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

const BANNER_STOPWORDS = new Set(["the", "official", "shop", "store", "a", "an", "and"])

function bannerMonogram(name: string): string {
  const words = name.split(/\s+/).filter(Boolean)
  const pick =
    words.find((word) => word.length >= 3 && !BANNER_STOPWORDS.has(word.toLowerCase())) ||
    words[0] ||
    "S"
  return pick.slice(0, 6).toUpperCase()
}

function trimUrl(raw: string | null | undefined): string | null {
  const t = typeof raw === "string" ? raw.trim() : ""
  return t.length > 0 ? t : null
}

function formatLastActive(lastActiveAt: string | null | undefined): string | null {
  if (!lastActiveAt?.trim()) return null
  const date = new Date(lastActiveAt)
  if (Number.isNaN(date.getTime())) return null
  return `Active ${formatDistanceToNow(date, { addSuffix: true })}`
}

function locationLabel(shop: SellerProfileHeroShop): string | null {
  const address = shop.shop_address?.trim()
  if (address) return address
  const city = shop.city?.trim()
  const region = shop.location?.trim()
  if (city && region) return `${city}, ${region}`
  return city || region || null
}

function ProfileTabLink({
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
        "-mb-px shrink-0 border-b-2 px-1 pb-3 pt-1 text-sm font-semibold transition-colors sm:text-[15px]",
        active
          ? "border-foreground text-foreground"
          : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

export function SellerProfileHero({
  shop,
  displayName,
  isShop,
  avgRating,
  reviewCount,
  currentListingCount,
  followerCount,
  followingCount: _followingCount,
  isFollowing,
  isOwnProfile,
  isLoggedIn,
  activeTab,
  onTabChange,
  soldCount,
  listingImageFallbacks,
}: SellerProfileHeroProps) {
  const profilePhotoUrl =
    trimUrl(shop.shop_logo_url) || trimUrl(shop.avatar_url)
  const avatarSrc = resolveSellerProfileDisplayImageUrl(
    {
      is_shop: isShop,
      shop_logo_url: shop.shop_logo_url,
      avatar_url: shop.avatar_url,
    },
    listingImageFallbacks,
  )
  const lastActiveLabel = formatLastActive(shop.last_active_at)
  const description = shop.shop_description || shop.bio
  const loc = locationLabel(shop)
  const monogram = bannerMonogram(displayName?.trim() || "Seller")

  return (
    <>
      <div className="border-b border-border/60 bg-background">
        <div className={cn(sellerProfileShellClassName, "py-3 sm:py-4")}>
          <SellersBreadcrumbs sellerName={displayName ?? "Seller"} className="min-w-0 max-w-full" />
        </div>
      </div>

      <div className={sellerProfileBannerClassName}>
        <SellerProfileBannerEditor
          initialBannerUrl={shop.shop_banner_url}
          initialFocalX={shop.shop_banner_focal_x_pct}
          initialFocalY={shop.shop_banner_focal_y_pct}
          monogram={monogram}
          editable={isOwnProfile}
        />
      </div>

      <div className={cn(sellerProfileShellClassName, "pt-5 sm:pt-6")}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5 lg:gap-6">
          {isOwnProfile ? (
            <SellerProfilePhotoEditor
              initialPhotoUrl={profilePhotoUrl}
              initialFocalX={shop.avatar_focal_x_pct}
              initialFocalY={shop.avatar_focal_y_pct}
              displayName={displayName?.trim() || "Seller"}
              editable
              className="pb-3 sm:pb-0"
            />
          ) : (
            <Avatar className="h-16 w-16 shrink-0 border border-border/80 shadow-sm sm:h-20 sm:w-20 lg:h-24 lg:w-24">
              {profilePhotoUrl ? (
                <ProfileAvatarImage
                  avatarUrl={profilePhotoUrl}
                  focalX={shop.avatar_focal_x_pct}
                  focalY={shop.avatar_focal_y_pct}
                  alt=""
                />
              ) : avatarSrc ? (
                <AvatarImage src={avatarSrc} alt="" />
              ) : null}
              <AvatarFallback className="bg-muted text-lg font-semibold text-foreground sm:text-xl">
                {displayName?.charAt(0).toUpperCase() || "S"}
              </AvatarFallback>
            </Avatar>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl lg:text-[28px]">
                    {displayName}
                  </h1>
                  {!isOwnProfile ? (
                    <FollowButton
                      sellerId={shop.id}
                      sellerName={displayName ?? undefined}
                      sellerSlug={shop.seller_slug || undefined}
                      sellerCity={shop.city || undefined}
                      initialFollowing={isFollowing}
                      initialFollowerCount={followerCount}
                      isLoggedIn={isLoggedIn}
                      size="sm"
                      appearance="profilePage"
                    />
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      {followerCount.toLocaleString()} follower{followerCount !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                {(loc || lastActiveLabel) && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-2">
                    {loc ? (
                      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                        <span>{loc}</span>
                      </p>
                    ) : null}
                    {!isOwnProfile ? (
                      <Button variant="outline" size="sm" className="h-8 rounded-full px-3 text-xs font-semibold" asChild>
                        <Link href={`/messages?seller=${shop.id}`}>
                          <MessageSquare className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                          Message
                        </Link>
                      </Button>
                    ) : null}
                    {lastActiveLabel ? (
                      <p className="text-xs text-muted-foreground">{lastActiveLabel}</p>
                    ) : null}
                  </div>
                )}

                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  {shop.shop_website ? (
                    <Button size="icon" variant="outline" className="h-8 w-8 rounded-full" asChild>
                      <a href={shop.shop_website} target="_blank" rel="noopener noreferrer" aria-label="Visit website">
                        <Globe className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  ) : null}
                  {shop.shop_phone ? (
                    <Button size="icon" variant="outline" className="h-8 w-8 rounded-full" asChild>
                      <a href={`tel:${shop.shop_phone}`} aria-label="Call seller">
                        <Phone className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  ) : null}
                  <ShareButton
                    title={displayName ?? "Seller profile"}
                    className="h-8 w-8 rounded-full"
                    iconClassName="h-3.5 w-3.5"
                  />
                </div>
              </div>

              {shop.shop_verified ? (
                <div className="flex shrink-0 flex-col items-center gap-1 text-center">
                  <VerifiedBadge size="lg" />
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Verified
                  </span>
                </div>
              ) : null}
            </div>

            {description ? (
              <p className="mt-4 max-w-4xl text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
                {description}
              </p>
            ) : null}
          </div>
        </div>

        <nav
          className="mt-6 flex gap-5 overflow-x-auto border-b border-border/80 sm:mt-8 sm:gap-8"
          aria-label="Seller profile sections"
        >
          <ProfileTabLink active={activeTab === "listings"} onClick={() => onTabChange("listings")}>
            Listings ({currentListingCount.toLocaleString()})
          </ProfileTabLink>
          <ProfileTabLink active={activeTab === "feedback"} onClick={() => onTabChange("feedback")}>
            <span className="inline-flex items-center gap-2">
              Feedback ({reviewCount.toLocaleString()})
              {reviewCount > 0 ? (
                <span
                  className="inline-flex items-center"
                  role="img"
                  aria-label={`${avgRating.toFixed(1)} out of 5 stars`}
                >
                  <SellerRatingStarRow value={avgRating} size="sm" />
                </span>
              ) : null}
            </span>
          </ProfileTabLink>
          <ProfileTabLink active={activeTab === "info"} onClick={() => onTabChange("info")}>
            Info &amp; Policies
          </ProfileTabLink>
          {soldCount > 0 ? (
            <ProfileTabLink active={activeTab === "sold"} onClick={() => onTabChange("sold")}>
              Sold ({soldCount.toLocaleString()})
            </ProfileTabLink>
          ) : null}
        </nav>
      </div>
    </>
  )
}
