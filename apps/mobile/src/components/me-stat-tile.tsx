import { SymbolView } from "expo-symbols"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { fontFamily, useReswellColors } from "@/theme"

/** Tappable stat chip — matches Me earnings row and dashboard cards. */
export function MeStatTile({
  label,
  value,
  reviewStar,
  accentValue,
  onPress,
}: {
  label: string
  value?: string
  /** Yellow star with count for reviews. */
  reviewStar?: boolean
  /** Earnings-style value in brand indigo (`listingHeart`). */
  accentValue?: boolean
  onPress?: () => void
}) {
  const colors = useReswellColors()
  const valueColor = accentValue ? colors.listingHeart : colors.foreground
  const body = (
    <>
      {reviewStar ? (
        <View style={styles.reviewValue}>
          <SymbolView
            name={{ ios: "star.fill", android: "star", web: "star" }}
            size={14}
            tintColor={colors.reviewStar}
          />
          <Text style={[styles.value, { color: valueColor, fontFamily: fontFamily.headline }]}>{value ?? "0"}</Text>
        </View>
      ) : (
        <Text style={[styles.value, { color: valueColor, fontFamily: fontFamily.headline }]}>{value ?? "0"}</Text>
      )}
      <Text style={[styles.label, { color: colors.muted, fontFamily: fontFamily.text }]} numberOfLines={2}>
        {label}
      </Text>
    </>
  )
  const tileStyle = [
    styles.tile,
    { backgroundColor: colors.secondary, borderColor: colors.border },
  ]
  if (!onPress) {
    return <View style={tileStyle}>{body}</View>
  }
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [...tileStyle, { opacity: pressed ? 0.92 : 1 }]}
    >
      {body}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    minHeight: 48,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  value: { fontSize: 15, fontWeight: "700" },
  label: { fontSize: 10, lineHeight: 13, textAlign: "center", fontWeight: "600" },
  reviewValue: { flexDirection: "row", alignItems: "center", gap: 3 },
})
