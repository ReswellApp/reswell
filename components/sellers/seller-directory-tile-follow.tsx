"use client"

import { FollowButton } from "@/components/follows/follow-button"
import { useSellersDirectoryViewer } from "@/components/sellers/sellers-directory-viewer"

type SellerDirectoryTileFollowProps = {
  sellerId: string
  sellerSlug: string | null
  sellerName: string
}

export function SellerDirectoryTileFollow({
  sellerId,
  sellerSlug,
  sellerName,
}: SellerDirectoryTileFollowProps) {
  const { userId, followingIds, hydrated } = useSellersDirectoryViewer()
  const isOwnProfile = hydrated && userId === sellerId
  if (isOwnProfile) return null

  return (
    <FollowButton
      key={hydrated ? "live" : "shell"}
      sellerId={sellerId}
      sellerSlug={sellerSlug}
      sellerName={sellerName}
      initialFollowing={followingIds.includes(sellerId)}
      isLoggedIn={userId != null}
      isOwnProfile={false}
      size="sm"
      appearance="directory"
      className="shrink-0"
    />
  )
}
