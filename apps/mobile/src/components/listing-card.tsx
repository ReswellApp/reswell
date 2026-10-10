import { Image } from "expo-image"
import { SymbolView } from "expo-symbols"
import { Pressable, StyleSheet, Text, View } from "react-native"
import type { MobileListingCard } from "@reswell/api-contract"
import { fontFamily, useReswellColors } from "@/theme"

/** Native drawing of the homepage peer tile: photo, title, condition line, price, ship mark. */
export function ListingCard({
  item,
  onPress,
  badge,
}: {
  item: MobileListingCard
  onPress: () => void
  /** Corner stamp for sold and shipped feed tiles. */
  badge?: string
}) {
  const colors = useReswellColors()

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={[styles.image, { backgroundColor: colors.image }]} contentFit="cover" />
        ) : (
          <View style={[styles.image, { backgroundColor: colors.image }]} />
        )}
        {badge ? (
          <View style={[styles.badge, { backgroundColor: colors.foreground }]}>
            <Text style={[styles.badgeText, { color: colors.primaryForeground, fontFamily: fontFamily.text }]}>
              {badge}
            </Text>
          </View>
        ) : null}
      </View>
      <Text numberOfLines={3} style={[styles.title, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
        {item.title}
      </Text>
      {item.condition_line ? (
        <Text numberOfLines={1} style={[styles.condition, { color: colors.muted, fontFamily: fontFamily.text }]}>
          {item.condition_line}
        </Text>
      ) : null}
      <View style={styles.priceRow}>
        <Text style={[styles.price, { color: colors.foreground, fontFamily: fontFamily.text }]}>{item.price_label}</Text>
        {item.shipping_available ? (
          <SymbolView name="truck.box" size={16} tintColor={colors.muted} />
        ) : null}
      </View>
    </Pressable>
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
  title: { fontSize: 14, fontWeight: "600", lineHeight: 18 },
  condition: { fontSize: 12, lineHeight: 16 },
  priceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  price: { fontSize: 16, fontWeight: "700" },
})
