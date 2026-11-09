import type { MobileListingCard, MobileListingCardSeller } from "@reswell/api-contract"
import { FeedListingCard } from "@/components/feed-listing-card"
import { ListingCard } from "@/components/listing-card"
import type { ListingLayout } from "@/components/listing-layout-switch"

/** Grid tile or feed-style single column — one entry point for marketplace listing lists. */
export function MarketplaceListingLayoutItem({
  layout,
  item,
  badge,
  onPress,
  viewerId,
  followBusy,
  onPressSeller,
  onFollowSeller,
  initialFavorited,
  onFavoritedChange,
}: {
  layout: ListingLayout
  item: MobileListingCard
  badge?: string
  onPress: () => void
  viewerId?: string | null
  followBusy?: boolean
  onPressSeller?: (seller: MobileListingCardSeller) => void
  onFollowSeller?: (seller: MobileListingCardSeller) => void
  initialFavorited?: boolean
  onFavoritedChange?: (favorited: boolean) => void
}) {
  if (layout === "list") {
    return (
      <FeedListingCard
        item={item}
        badge={badge}
        onPress={onPress}
        viewerId={viewerId}
        followBusy={followBusy}
        onPressSeller={onPressSeller}
        onFollowSeller={onFollowSeller}
        initialFavorited={initialFavorited}
        onFavoritedChange={onFavoritedChange}
      />
    )
  }

  return (
    <ListingCard
      item={item}
      badge={badge}
      onPress={onPress}
      viewerId={viewerId}
      initialFavorited={initialFavorited}
      onFavoritedChange={onFavoritedChange}
    />
  )
}
