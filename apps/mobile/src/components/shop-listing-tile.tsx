import { Image } from "expo-image"
import { Pressable, StyleSheet, Text, View } from "react-native"
import type { MobileListingCard } from "@reswell/api-contract"
import { fontFamily, useReswellColors } from "@/theme"

/** Your own inventory. Status and price, without the buyer heart, cart, or shipping marks. */
export function ShopListingTile({
  item,
  status,
  onPress,
}: {
  item: MobileListingCard
  status: "Active" | "Sold"
  onPress: () => void
}) {
  const colors = useReswellColors()
  return (
    <Pressable onPress={onPress} style={styles.card} accessibilityRole="button">
      {item.image_url ? (
        <Image source={{ uri: item.image_url }} style={[styles.image, { backgroundColor: colors.image }]} contentFit="cover" />
      ) : (
        <View style={[styles.image, { backgroundColor: colors.image }]} />
      )}
      <Text style={[styles.status, { color: colors.muted, fontFamily: fontFamily.text }]}>{status}</Text>
      <Text numberOfLines={2} style={[styles.title, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
        {item.title}
      </Text>
      {item.condition_line ? (
        <Text numberOfLines={1} style={[styles.condition, { color: colors.muted, fontFamily: fontFamily.text }]}>
          {item.condition_line}
        </Text>
      ) : null}
      <Text style={[styles.price, { color: colors.foreground, fontFamily: fontFamily.text }]}>{item.price_label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: { flex: 1, gap: 4, marginBottom: 18 },
  image: { width: "100%", aspectRatio: 3 / 4, borderRadius: 12 },
  status: { fontSize: 12, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase", marginTop: 6 },
  title: { fontSize: 14, fontWeight: "600", lineHeight: 18 },
  condition: { fontSize: 12, lineHeight: 16 },
  price: { fontSize: 16, fontWeight: "700" },
})
