import { Image } from "expo-image"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { BrandLogoMark } from "@/components/brands/brand-logo-mark"
import { fontFamily, useReswellColors } from "@/theme"

const TILE_WIDTH = 148

/** Catalog model card for the brand-page rail. */
export function BrandModelTile({
  name,
  categoryLabel,
  imageUrl,
  brandName,
  brandLogoUrl,
  onPress,
}: {
  name: string
  categoryLabel: string
  imageUrl: string | null
  brandName: string
  brandLogoUrl: string | null
  onPress: () => void
}) {
  const colors = useReswellColors()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${categoryLabel}`}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed ? styles.pressed : null]}
    >
      <View style={[styles.frame, { backgroundColor: colors.image }]}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.photo} contentFit="contain" />
        ) : (
          <BrandLogoMark name={brandName} logoUrl={brandLogoUrl} size={52} radius={12} decorative />
        )}
      </View>
      <Text numberOfLines={2} style={[styles.name, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
        {name}
      </Text>
      <Text numberOfLines={1} style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>
        {categoryLabel}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  tile: { width: TILE_WIDTH, gap: 8 },
  pressed: { opacity: 0.72 },
  frame: {
    width: "100%",
    aspectRatio: 4 / 5,
    borderRadius: 14,
    borderCurve: "continuous",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  photo: { width: "86%", height: "86%" },
  name: { fontSize: 14, fontWeight: "700", lineHeight: 18, letterSpacing: -0.2 },
  meta: { fontSize: 12, fontWeight: "600" },
})
