import { Pressable, StyleSheet, Text, View } from "react-native"
import type { MobileBrandCard } from "@reswell/api-contract"
import { BrandLogoMark } from "@/components/brands/brand-logo-mark"
import { fontFamily, useReswellColors } from "@/theme"

function statsLabel(brand: MobileBrandCard): string {
  const parts: string[] = []
  if (brand.listing_count > 0) {
    parts.push(brand.listing_count === 1 ? "1 for sale" : `${brand.listing_count.toLocaleString("en-US")} for sale`)
  }
  if (brand.model_count > 0) {
    parts.push(brand.model_count === 1 ? "1 model" : `${brand.model_count.toLocaleString("en-US")} models`)
  }
  return parts.join(" · ") || "Catalog"
}

export function BrandDirectoryCard({ brand, onPress }: { brand: MobileBrandCard; onPress: () => void }) {
  const colors = useReswellColors()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${brand.name}. ${statsLabel(brand)}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
        pressed ? styles.pressed : null,
      ]}
    >
      <BrandLogoMark name={brand.name} logoUrl={brand.logo_url} size={56} radius={14} decorative />
      <View style={styles.copy}>
        <Text numberOfLines={2} style={[styles.name, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
          {brand.name}
        </Text>
        {brand.location_label ? (
          <Text numberOfLines={1} style={[styles.location, { color: colors.muted, fontFamily: fontFamily.text }]}>
            {brand.location_label}
          </Text>
        ) : null}
        <Text numberOfLines={1} style={[styles.stats, { color: colors.muted, fontFamily: fontFamily.text }]}>
          {statsLabel(brand)}
        </Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 14,
    borderRadius: 16,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
  },
  pressed: { opacity: 0.92 },
  copy: { width: "100%", alignItems: "center", gap: 3 },
  name: { fontSize: 15, fontWeight: "700", letterSpacing: -0.2, textAlign: "center", lineHeight: 19 },
  location: { fontSize: 12, fontWeight: "600", textAlign: "center" },
  stats: { fontSize: 11, fontWeight: "600", textAlign: "center", marginTop: 2 },
})
