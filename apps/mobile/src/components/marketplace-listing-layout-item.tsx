import { View } from "react-native"
import type { MobileListingCard, MobileListingCardSeller } from "@reswell/api-contract"
import { FeedListingCard } from "@/components/feed-listing-card"
import { ListingCard } from "@/components/listing-card"
import type { ListingLayout } from "@/components/listing-layout-switch"
import { listingGridRowSpacerStyle, listingGridRowStyle } from "@/components/listing-list-layout"

export type MarketplaceListingRow =
  | { key: string; layout: "list"; item: MobileListingCard }
  | { key: string; layout: "grid"; left: MobileListingCard; right: MobileListingCard | null }

/** Pair grid tiles into one-column rows so marketplace `FlatList`s never remount. */
export function marketplaceListingRows(
  listings: MobileListingCard[],
  layout: ListingLayout,
): MarketplaceListingRow[] {
  if (layout === "list") {
    return listings.map((item) => ({ key: item.id, layout: "list" as const, item }))
  }

  const rows: MarketplaceListingRow[] = []
  for (let index = 0; index < listings.length; index += 2) {
    const left = listings[index]
    if (!left) break
    rows.push({
      key: `grid:${left.id}`,
      layout: "grid",
      left,
      right: listings[index + 1] ?? null,
    })
  }
  return rows
}

/** Grid tile pair or feed-style row — one entry point for marketplace listing lists. */
export function MarketplaceListingLayoutItem({
  row,
  badge,
  onPress,
  viewerId,
  followBusyId,
  onPressSeller,
  onFollowSeller,
  initialFavorited,
  onFavoritedChange,
}: {
  row: MarketplaceListingRow
  badge?: string
  onPress: (item: MobileListingCard) => void
  viewerId?: string | null
  followBusyId?: string | null
  onPressSeller?: (seller: MobileListingCardSeller) => void
  onFollowSeller?: (seller: MobileListingCardSeller) => void
  initialFavorited?: boolean
  onFavoritedChange?: (favorited: boolean) => void
}) {
  if (row.layout === "list") {
    const item = row.item
    return (
      <FeedListingCard
        item={item}
        badge={badge}
        onPress={() => onPress(item)}
        viewerId={viewerId}
        followBusy={followBusyId === item.seller?.id}
        onPressSeller={onPressSeller}
        onFollowSeller={onFollowSeller}
        initialFavorited={initialFavorited}
        onFavoritedChange={onFavoritedChange}
      />
    )
  }

  const right = row.right
  return (
    <View style={listingGridRowStyle}>
      <ListingCard
        item={row.left}
        badge={badge}
        onPress={() => onPress(row.left)}
        viewerId={viewerId}
        initialFavorited={initialFavorited}
        onFavoritedChange={onFavoritedChange}
      />
      {right ? (
        <ListingCard
          item={right}
          badge={badge}
          onPress={() => onPress(right)}
          viewerId={viewerId}
          initialFavorited={initialFavorited}
          onFavoritedChange={onFavoritedChange}
        />
      ) : (
        <View style={listingGridRowSpacerStyle} />
      )}
    </View>
  )
}
