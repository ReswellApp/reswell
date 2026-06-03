"use client"

import { FollowButton } from "@/components/follows/follow-button"

type SellerDirectoryTileFollowProps = {
  sellerId: string
  sellerSlug: string | null
  sellerName: string
  initialFollowing: boolean
  isLoggedIn: boolean
  isOwnProfile: boolean
}

export function SellerDirectoryTileFollow({
  sellerId,
  sellerSlug,
  sellerName,
  initialFollowing,
  isLoggedIn,
  isOwnProfile,
}: SellerDirectoryTileFollowProps) {
  if (isOwnProfile) return null

  return (
    <FollowButton
      sellerId={sellerId}
      sellerSlug={sellerSlug}
      sellerName={sellerName}
      initialFollowing={initialFollowing}
      isLoggedIn={isLoggedIn}
      isOwnProfile={false}
      size="sm"
      appearance="directory"
      className="shrink-0"
    />
  )
}
