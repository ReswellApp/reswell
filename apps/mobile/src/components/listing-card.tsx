import { Image } from "expo-image"
import { SymbolView } from "expo-symbols"
import { Pressable, StyleSheet, Text, View } from "react-native"
import type { MobileListingCard } from "@reswell/api-contract"
import { fontFamily, useReswellColors } from "@/theme"

/** Native drawing of the homepage peer tile: photo, title, condition line, price, ship mark. */
export function ListingCard({
  item,
  onPress,
}: {
  item: MobileListingCard
  onPress: () => void
}) {
  const colors = useReswellColors()

  return (
    <Pressable onPress={onPress} style={styles.card}>
      {item.image_url ? (
        <Image source={{ uri: item.image_url }} style={[styles.image, { backgroundColor: colors.image }]} contentFit="cover" />
      ) : (
        <View style={[styles.image, { backgroundColor: colors.image }]} />
      )}
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
  title: { fontSize: 14, fontWeight: "600", lineHeight: 18 },
  condition: { fontSize: 12, lineHeight: 16 },
  priceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  price: { fontSize: 16, fontWeight: "700" },
})
