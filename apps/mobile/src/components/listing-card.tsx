import { Image } from "expo-image"
import { SymbolView } from "expo-symbols"
import { Pressable, StyleSheet, Text, View } from "react-native"
import type { MobileListingCard } from "@reswell/api-contract"
import { ListingCartButton, ListingFavoriteButton } from "@/components/listing-tile-actions"
import { fontFamily, useReswellColors } from "@/theme"

/** Same peer sections the website cart button uses. */
const PEER_SECTIONS = new Set([
  "surfboards",
  "fins",
  "wetsuits",
  "boardbags",
  "surfpacks",
  "leashes",
  "apparel",
  "accessories",
  "magazines",
  "traction",
])

function canAddToCart(item: MobileListingCard, badge?: string): boolean {
  if (badge) return false
  if (!PEER_SECTIONS.has(item.section)) return false
  return item.local_pickup || item.shipping_available
}

/** Homepage peer tile: photo, heart, title, condition, price, ship mark, and cart. */
export function ListingCard({
  item,
  onPress,
  badge,
  initialFavorited,
  onFavoritedChange,
}: {
  item: MobileListingCard
  onPress: () => void
  /** Corner stamp for sold and shipped feed tiles. Hides the cart button. */
  badge?: string
  initialFavorited?: boolean
  onFavoritedChange?: (favorited: boolean) => void
}) {
  const colors = useReswellColors()
  const showCart = canAddToCart(item, badge)

  return (
    <View style={styles.card}>
      <View>
        <Pressable onPress={onPress} accessibilityRole="button">
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={[styles.image, { backgroundColor: colors.image }]} contentFit="cover" />
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
        <Text numberOfLines={3} style={[styles.title, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
          {item.title}
        </Text>
        {item.condition_line ? (
          <Text numberOfLines={1} style={[styles.condition, { color: colors.muted, fontFamily: fontFamily.text }]}>
            {item.condition_line}
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
  )
}

const styles = StyleSheet.create({
  card: { flex: 1, gap: 4, marginBottom: 18 },
  image: { width: "100%", aspectRatio: 3 / 4, borderRadius: 12 },
  badge: {
    position: "absolute",
    top: 8,
    left: 8,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 11, fontWeight: "600", letterSpacing: 0.4, textTransform: "uppercase" },
  copy: { gap: 4 },
  title: { fontSize: 14, fontWeight: "600", lineHeight: 18 },
  condition: { fontSize: 12, lineHeight: 16 },
  priceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  pricePress: { flexShrink: 1 },
  price: { fontSize: 16, fontWeight: "700" },
  actions: { flexDirection: "row", alignItems: "center", gap: 6 },
})
