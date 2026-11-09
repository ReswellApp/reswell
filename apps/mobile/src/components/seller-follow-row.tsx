import { SymbolView } from "expo-symbols"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { ProfileCircle } from "@/components/profile-circle"
import { fontFamily, useReswellColors } from "@/theme"

export type SellerFollowRowSeller = {
  id: string
  seller_slug: string
  name: string
  avatar_url: string | null
  city: string | null
  verified: boolean
}

export function followedSellerSubtitle(seller: Pick<SellerFollowRowSeller, "seller_slug" | "city">): string {
  const handle = `@${seller.seller_slug}`
  const city = seller.city?.trim()
  return city ? `${handle} · ${city}` : handle
}

function SellerIdentity({
  seller,
  onPress,
}: {
  seller: SellerFollowRowSeller
  onPress: () => void
}) {
  const colors = useReswellColors()
  const subtitle = followedSellerSubtitle(seller)

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.identity, pressed ? styles.pressed : null]}
    >
      <ProfileCircle url={seller.avatar_url} size={48} />
      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <Text numberOfLines={1} style={[styles.title, { color: colors.foreground, fontFamily: fontFamily.text }]}>
            {seller.name}
          </Text>
          {seller.verified ? (
            <SymbolView
              name={{ ios: "checkmark.seal.fill", android: "verified", web: "verified" }}
              size={14}
              tintColor={colors.shipping}
            />
          ) : null}
        </View>
        <Text numberOfLines={1} style={[styles.subtitle, { color: colors.muted, fontFamily: fontFamily.text }]}>
          {subtitle}
        </Text>
      </View>
    </Pressable>
  )
}

export function SellerFollowRow({
  seller,
  onPressProfile,
  onUnfollow,
}: {
  seller: SellerFollowRowSeller
  onPressProfile: () => void
  /** When set, shows a Following pill that unfollows without opening the profile. */
  onUnfollow?: () => void
}) {
  const colors = useReswellColors()

  return (
    <View style={[styles.row, { borderColor: colors.border }]}>
      <SellerIdentity seller={seller} onPress={onPressProfile} />
      {onUnfollow ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Unfollow ${seller.name}`}
          hitSlop={8}
          onPress={onUnfollow}
          style={({ pressed }) => [
            styles.followPill,
            { backgroundColor: colors.image, borderColor: colors.border },
            pressed ? styles.pressed : null,
          ]}
        >
          <Text style={[styles.followLabel, { color: colors.shipping, fontFamily: fontFamily.text }]}>Following</Text>
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View ${seller.name}`}
          hitSlop={8}
          onPress={onPressProfile}
          style={({ pressed }) => [styles.chevronHit, pressed ? styles.pressed : null]}
        >
          <SymbolView name={{ ios: "chevron.right", android: "chevron_right", web: "chevron_right" }} size={14} tintColor={colors.muted} />
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 16,
    paddingRight: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  identity: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minWidth: 0 },
  pressed: { opacity: 0.65 },
  copy: { flex: 1, gap: 2, minWidth: 0 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 5, minWidth: 0 },
  title: { flexShrink: 1, fontSize: 16, fontWeight: "600" },
  subtitle: { fontSize: 14 },
  followPill: {
    minWidth: 92,
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  followLabel: { fontSize: 13, fontWeight: "700" },
  chevronHit: { padding: 4, flexShrink: 0 },
})
