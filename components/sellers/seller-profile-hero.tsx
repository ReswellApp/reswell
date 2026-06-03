"use client"

import type { LucideIcon } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import {
  Calendar,
  Globe,
  MapPin,
  MessageSquare,
  Package,
  Phone,
  ShoppingBag,
  TrendingUp,
  Users,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { VerifiedBadge, verifiedSellerBadgeClassName } from "@/components/verified-badge"
import { FollowButton } from "@/components/follows/follow-button"
import { SellerRatingStarRow } from "@/components/seller-rating-stars"
import { wideShimmer } from "@/lib/image-shimmer"
export type SellerProfileHeroShop = {
  id: string
  seller_slug: string
  display_name: string | null
  avatar_url: string | null
  city: string | null
  bio: string | null
  created_at: string
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

type SellerProfileHeroProps = {
  shop: SellerProfileHeroShop
  displayName: string | null | undefined
  isShop: boolean | null | undefined
  avgRating: number
  reviewCount: number
  currentListingCount: number
  followerCount: number
  isFollowing: boolean
  isOwnProfile: boolean
  isLoggedIn: boolean
}

function StatPill({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: string | number
}) {
  return (
    <div className="inline-flex min-w-0 items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-sm shadow-sm backdrop-blur-sm">
      <Icon className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
      <span className="truncate">
        <span className="sr-only">{label}: </span>
        <span className="font-semibold tabular-nums text-foreground">{value}</span>
        <span className="text-muted-foreground"> {label}</span>
      </span>
    </div>
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
  isFollowing,
  isOwnProfile,
  isLoggedIn,
}: SellerProfileHeroProps) {
  const salesCount = shop.sales_count ?? 0
  const avatarSrc = (isShop ? shop.shop_logo_url : shop.avatar_url) || ""
  const description = shop.shop_description || shop.bio

  return (
    <>
      <div className="border-b border-border/80 bg-muted/15">
        <div className="container mx-auto max-w-6xl px-4 py-5 sm:px-6">
          <Link
            href="/sellers"
            className="inline-flex text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            ← All sellers
          </Link>
        </div>
      </div>

      <header className="relative overflow-hidden border-b border-border/80">
        <div className="relative h-44 sm:h-56 lg:h-64">
          {shop.shop_banner_url ? (
            <Image
              src={shop.shop_banner_url}
              alt=""
              fill
              sizes="100vw"
              className="object-cover"
              placeholder="blur"
              blurDataURL={wideShimmer}
              priority
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-muted/50 to-offwhite" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-black/10" />
        </div>

        <div className="container relative mx-auto max-w-6xl px-4 sm:px-6">
          <div className="-mt-14 pb-8 sm:-mt-16 sm:pb-10">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:gap-5">
                <Avatar className="h-24 w-24 shrink-0 border-4 border-background shadow-lg ring-2 ring-primary/10 sm:h-28 sm:w-28">
                  <AvatarImage src={avatarSrc} alt="" />
                  <AvatarFallback className="bg-primary text-2xl font-semibold text-primary-foreground">
                    {displayName?.charAt(0).toUpperCase() || "S"}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 pb-1">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    {isShop ? "Shop" : "Seller"}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
                      {displayName}
                    </h1>
                    {shop.shop_verified ? (
                      <Badge variant="outline" className={verifiedSellerBadgeClassName}>
                        <VerifiedBadge size="sm" className="-ml-0.5 mr-px" />
                        Verified
                      </Badge>
                    ) : null}
                    {isShop && !shop.shop_verified ? <Badge variant="secondary">Seller</Badge> : null}
                  </div>

                  {(shop.city || shop.shop_address) && (
                    <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                      <span className="truncate">{shop.shop_address || shop.city}</span>
                    </p>
                  )}

                  {reviewCount > 0 ? (
                    <p
                      className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"
                      role="img"
                      aria-label={`Average ${avgRating.toFixed(1)} out of 5 stars from ${reviewCount} reviews`}
                    >
                      <SellerRatingStarRow value={avgRating} size="sm" />
                      <span className="font-semibold tabular-nums text-foreground">{avgRating.toFixed(1)}</span>
                      <span className="text-muted-foreground">
                        ({reviewCount} review{reviewCount !== 1 ? "s" : ""})
                      </span>
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <FollowButton
                  sellerId={shop.id}
                  sellerName={displayName ?? undefined}
                  sellerSlug={shop.seller_slug || undefined}
                  sellerCity={shop.city || undefined}
                  initialFollowing={isFollowing}
                  initialFollowerCount={followerCount}
                  isLoggedIn={isLoggedIn}
                  isOwnProfile={isOwnProfile}
                  showCount={true}
                />
                {shop.shop_website ? (
                  <Button variant="outline" size="sm" className="rounded-full" asChild>
                    <a href={shop.shop_website} target="_blank" rel="noopener noreferrer">
                      <Globe className="mr-1.5 h-3.5 w-3.5" />
                      Website
                    </a>
                  </Button>
                ) : null}
                {shop.shop_phone ? (
                  <Button variant="outline" size="sm" className="rounded-full" asChild>
                    <a href={`tel:${shop.shop_phone}`}>
                      <Phone className="mr-1.5 h-3.5 w-3.5" />
                      Call
                    </a>
                  </Button>
                ) : null}
                <Button variant="outline" size="sm" className="rounded-full" asChild>
                  <Link href={`/messages?seller=${shop.id}`}>
                    <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                    Message
                  </Link>
                </Button>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <StatPill icon={TrendingUp} label="sold" value={salesCount} />
              <StatPill icon={ShoppingBag} label="listed now" value={currentListingCount} />
              {followerCount > 0 ? (
                <StatPill icon={Users} label="followers" value={followerCount} />
              ) : null}
              <StatPill
                icon={Calendar}
                label="on Reswell"
                value={new Date(shop.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  year: "numeric",
                })}
              />
            </div>

            {description ? (
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-[17px]">
                {description}
              </p>
            ) : null}
          </div>
        </div>
      </header>
    </>
  )
}
