import { SymbolView } from "expo-symbols"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { fontFamily, useReswellColors } from "@/theme"

/** Tappable stat chip — matches Me earnings row and dashboard cards. */
export function MeStatTile({
  label,
  value,
  reviewStar,
  accentValue,
  plain,
  onPress,
}: {
  label: string
  value?: string
  /** Yellow star with count for reviews. */
  reviewStar?: boolean
  /** Earnings-style value in brand dark blue (`BRAND_DARK_BLUE`). */
  accentValue?: boolean
  /** No chip background — value/label only (Me earnings row). */
  plain?: boolean
  onPress?: () => void
}) {
  const colors = useReswellColors()
  const valueColor = accentValue ? colors.listingHeart : colors.foreground
  const tileStyle = plain
    ? [styles.tilePlain]
    : [styles.tile, { backgroundColor: colors.secondary, borderColor: colors.border }]
  const valueStyle = plain ? styles.valuePlain : styles.value
  const labelStyle = plain ? styles.labelPlain : styles.label
  const body = (
    <>
      {reviewStar ? (
        <View style={styles.reviewValue}>
          <SymbolView
            name={{ ios: "star.fill", android: "star", web: "star" }}
            size={14}
            tintColor={colors.reviewStar}
          />
          <Text style={[valueStyle, { color: valueColor, fontFamily: fontFamily.headline }]}>{value ?? "0"}</Text>
        </View>
      ) : (
        <Text
          numberOfLines={plain ? 1 : undefined}
          adjustsFontSizeToFit={Boolean(plain)}
          minimumFontScale={plain ? 0.55 : undefined}
          style={[valueStyle, plain ? styles.valuePlainFit : null, { color: valueColor, fontFamily: fontFamily.headline }]}
        >
          {value ?? "0"}
        </Text>
      )}
      <Text style={[labelStyle, { color: colors.muted, fontFamily: fontFamily.text }]} numberOfLines={2}>
        {label}
      </Text>
    </>
  )
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
  tilePlain: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 4,
    minWidth: 0,
    paddingTop: 2,
    paddingHorizontal: 6,
  },
  value: { fontSize: 15, fontWeight: "700" },
  valuePlain: {
    height: 28,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
    letterSpacing: -0.4,
    textAlign: "center",
  },
  valuePlainFit: { width: "100%" },
  label: { fontSize: 10, lineHeight: 13, textAlign: "center", fontWeight: "600" },
  labelPlain: { height: 36, fontSize: 13, lineHeight: 17, textAlign: "center", fontWeight: "500" },
  reviewValue: { flexDirection: "row", alignItems: "center", gap: 3 },
})
