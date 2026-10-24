import { Image } from "expo-image"
import { SymbolView } from "expo-symbols"
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native"
import type { MobileListingCard, MobileListingCardSeller } from "@reswell/api-contract"
import { listingListColumnStyle, LISTING_TILE_ASPECT } from "@/components/listing-list-layout"
import { ListingCartButton, ListingFavoriteButton } from "@/components/listing-tile-actions"
import { canShowListingCartButton } from "@/lib/listing-cart-tile"
import { fontFamily, useReswellColors } from "@/theme"

function sellerHandle(seller: MobileListingCardSeller): string {
  if (seller.seller_slug) return `@${seller.seller_slug}`
  return seller.name
}

function FeedListingSellerBar({
  seller,
  ownSeller,
  followBusy,
  onPressSeller,
  onFollow,
}: {
  seller: MobileListingCardSeller
  ownSeller: boolean
  followBusy?: boolean
  onPressSeller: () => void
  onFollow: () => void
}) {
  const colors = useReswellColors()
  return (
    <View style={styles.sellerRow}>
      <Pressable onPress={onPressSeller} style={styles.sellerIdentity} accessibilityRole="button">
        {seller.avatar_url ? (
          <Image source={{ uri: seller.avatar_url }} style={[styles.sellerAvatar, { backgroundColor: colors.image }]} />
        ) : (
          <View style={[styles.sellerAvatar, styles.sellerAvatarFallback, { backgroundColor: colors.image }]}>
            <Text style={[styles.sellerAvatarLabel, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
              {seller.name.slice(0, 1).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.sellerCopy}>
          <Text numberOfLines={1} style={[styles.sellerName, { color: colors.foreground, fontFamily: fontFamily.text }]}>
            {sellerHandle(seller)}
          </Text>
          {seller.verified ? (
            <SymbolView name="checkmark.seal.fill" size={12} tintColor={colors.primary} />
          ) : null}
        </View>
      </Pressable>
      {ownSeller ? null : (
        <Pressable
          onPress={onFollow}
          disabled={followBusy}
          style={[
            styles.follow,
            seller.following
              ? { backgroundColor: colors.background, borderColor: colors.border }
              : { backgroundColor: colors.primary, borderColor: colors.primary },
          ]}
        >
          {followBusy ? (
            <ActivityIndicator color={seller.following ? colors.foreground : colors.primaryForeground} />
          ) : (
            <Text
              style={[
                styles.followLabel,
                {
                  color: seller.following ? colors.foreground : colors.primaryForeground,
                  fontFamily: fontFamily.text,
                },
              ]}
            >
              {seller.following ? "Following" : "Follow"}
            </Text>
          )}
        </Pressable>
      )}
    </View>
  )
}

/** Single-column feed row: seller header, photo, title, price, and actions. */
export function FeedListingCard({
  item,
  onPress,
  badge,
  initialFavorited,
  onFavoritedChange,
  viewerId,
  followBusy,
  onFollowSeller,
  onPressSeller,
}: {
  item: MobileListingCard
  onPress: () => void
  badge?: string
  initialFavorited?: boolean
  onFavoritedChange?: (favorited: boolean) => void
  viewerId?: string | null
  followBusy?: boolean
  onFollowSeller?: (seller: MobileListingCardSeller) => void
  onPressSeller?: (seller: MobileListingCardSeller) => void
}) {
  const colors = useReswellColors()
  const seller = item.seller
  const ownSeller = Boolean(seller && viewerId && seller.id === viewerId)
  const showCart = canShowListingCartButton(item, { badge, viewerId })

  return (
    <View style={styles.card}>
      <View style={listingListColumnStyle}>
        {seller ? (
          <FeedListingSellerBar
            seller={seller}
            ownSeller={ownSeller}
            followBusy={followBusy}
            onPressSeller={() => onPressSeller?.(seller)}
            onFollow={() => onFollowSeller?.(seller)}
          />
        ) : null}
        <View>
          <Pressable onPress={onPress} accessibilityRole="button">
            {item.image_url ? (
              <Image
                source={{ uri: item.image_url }}
                style={[styles.image, { backgroundColor: colors.image }]}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.image, { backgroundColor: colors.image }]} />
            )}
          </Pressable>
          {badge ? (
            <View style={[styles.badge, { backgroundColor: colors.foreground }]}>
              <Text style={[styles.badgeText, { color: colors.primaryForeground, fontFamily: fontFamily.text }]}>
                {badge}
              </Text>
            </View>
          ) : null}
          <ListingFavoriteButton
            listingId={item.id}
            initialFavorited={initialFavorited}
            onFavoritedChange={onFavoritedChange}
          />
        </View>
        <Pressable onPress={onPress} style={styles.copy}>
          <Text numberOfLines={2} style={[styles.title, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
            {item.title}
          </Text>
          {item.condition_line ? (
            <Text numberOfLines={1} style={[styles.condition, { color: colors.muted, fontFamily: fontFamily.text }]}>
              {item.condition_line}
            </Text>
          ) : null}
          {item.listed_label ? (
            <Text style={[styles.listed, { color: colors.muted, fontFamily: fontFamily.text }]}>
              Listed {item.listed_label}
            </Text>
          ) : null}
        </Pressable>
        <View style={styles.priceRow}>
          <Pressable onPress={onPress} style={styles.pricePress}>
            <Text style={[styles.price, { color: colors.foreground, fontFamily: fontFamily.text }]}>{item.price_label}</Text>
          </Pressable>
          <View style={styles.actions}>
            {item.shipping_available ? <SymbolView name="truck.box" size={16} tintColor={colors.muted} /> : null}
            {showCart ? <ListingCartButton listingId={item.id} /> : null}
          </View>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { marginBottom: 18 },
  sellerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  sellerIdentity: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 },
  sellerAvatar: { width: 30, height: 30, borderRadius: 15 },
  sellerAvatarFallback: { alignItems: "center", justifyContent: "center" },
  sellerAvatarLabel: { fontSize: 13, fontWeight: "700" },
  sellerCopy: { flex: 1, flexDirection: "row", alignItems: "center", gap: 4, minWidth: 0 },
  sellerName: { flexShrink: 1, fontSize: 14, fontWeight: "600" },
  follow: {
    minWidth: 76,
    minHeight: 30,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  followLabel: { fontSize: 13, fontWeight: "600" },
  image: { width: "100%", aspectRatio: LISTING_TILE_ASPECT, borderRadius: 10 },
  badge: {
    position: "absolute",
    top: 6,
    left: 6,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 10, fontWeight: "600", letterSpacing: 0.4, textTransform: "uppercase" },
  copy: { gap: 2 },
  title: { fontSize: 14, fontWeight: "600", lineHeight: 18 },
  condition: { fontSize: 12, lineHeight: 16 },
  listed: { fontSize: 11, lineHeight: 15 },
  priceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  pricePress: { flexShrink: 1 },
  price: { fontSize: 16, fontWeight: "700" },
  actions: { flexDirection: "row", alignItems: "center", gap: 6 },
})
