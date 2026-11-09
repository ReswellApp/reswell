import { Pressable, StyleSheet, Text, View } from "react-native"
import { fontFamily, useReswellColors } from "@/theme"

/** Listings · followers · following with vertical dividers. */
export function ProfileStatsRow({
  listingCount,
  followerCount,
  followingCount,
  onListings,
  onFollowers,
  onFollowing,
}: {
  listingCount: number
  followerCount: number
  followingCount?: number
  onListings?: () => void
  onFollowers?: () => void
  onFollowing?: () => void
}) {
  const colors = useReswellColors()
  const items: { value: string; label: string; onPress?: () => void }[] = [
    { value: String(listingCount), label: "Listings", onPress: onListings },
    { value: String(followerCount), label: "Followers", onPress: onFollowers },
  ]
  if (followingCount != null) {
    items.push({ value: String(followingCount), label: "Following", onPress: onFollowing })
  }

  return (
    <View style={styles.row}>
      {items.map((item, index) => (
        <View key={item.label} style={styles.cellWrap}>
          {index > 0 ? <View style={[styles.divider, { backgroundColor: colors.border }]} /> : null}
          {item.onPress ? (
            <Pressable accessibilityRole="button" onPress={item.onPress} style={styles.cell}>
              <Text style={[styles.value, { color: colors.foreground, fontFamily: fontFamily.headline }]}>{item.value}</Text>
              <Text style={[styles.label, { color: colors.muted, fontFamily: fontFamily.text }]}>{item.label}</Text>
            </Pressable>
          ) : (
            <View style={styles.cell}>
              <Text style={[styles.value, { color: colors.foreground, fontFamily: fontFamily.headline }]}>{item.value}</Text>
              <Text style={[styles.label, { color: colors.muted, fontFamily: fontFamily.text }]}>{item.label}</Text>
            </View>
          )}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "stretch", paddingVertical: 4 },
  cellWrap: { flex: 1, flexDirection: "row", alignItems: "stretch" },
  cell: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2, paddingVertical: 4 },
  value: { fontSize: 17, fontWeight: "700" },
  label: { fontSize: 12, fontWeight: "600" },
  divider: { width: StyleSheet.hairlineWidth, marginVertical: 4 },
})
