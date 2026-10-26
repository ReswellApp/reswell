import { SymbolView } from "expo-symbols"
import { ProfileCircle } from "@/components/profile-circle"
import { Linking, Pressable, StyleSheet, Text, View } from "react-native"
import { fontFamily, useReswellColors } from "@/theme"

export function MeProfileHeader({
  displayName,
  username,
  avatarUrl,
  websiteUrl,
  onSellerProfile,
  sellerProfileLabel,
}: {
  displayName: string
  username: string | null
  avatarUrl: string | null
  websiteUrl: string | null
  onSellerProfile?: () => void
  sellerProfileLabel?: string
}) {
  const colors = useReswellColors()
  return (
    <View>
      <View style={styles.identity}>
        <ProfileCircle url={avatarUrl} size={72} />
        <View style={styles.identityCopy}>
          <Text style={[styles.displayName, { color: colors.foreground, fontFamily: fontFamily.headline }]} numberOfLines={2}>
            {displayName}
          </Text>
          {username ? (
            <Text style={[styles.handle, { color: colors.muted, fontFamily: fontFamily.text }]} numberOfLines={1}>
              @{username}
            </Text>
          ) : null}
        </View>
      </View>
      {onSellerProfile && sellerProfileLabel ? (
        <Pressable
          accessibilityRole="button"
          onPress={onSellerProfile}
          style={({ pressed }) => [
            styles.storefront,
            {
              backgroundColor: colors.secondary,
              borderColor: colors.border,
              opacity: pressed ? 0.88 : 1,
            },
          ]}
        >
          <SymbolView name={{ ios: "storefront", android: "store", web: "store" }} size={18} tintColor={colors.listingHeart} />
          <Text style={[styles.storefrontLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>{sellerProfileLabel}</Text>
        </Pressable>
      ) : null}
      {websiteUrl ? (
        <Pressable onPress={() => void Linking.openURL(websiteUrl)}>
          <Text style={[styles.website, { color: colors.foreground, fontFamily: fontFamily.text }]}>{websiteUrl}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  identity: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingTop: 12 },
  identityCopy: { flex: 1, gap: 2 },
  displayName: { fontSize: 22, fontWeight: "700", lineHeight: 28 },
  handle: { fontSize: 15, fontWeight: "600" },
  storefront: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  storefrontLabel: { fontSize: 15, fontWeight: "700" },
  website: { paddingHorizontal: 16, paddingTop: 6, fontSize: 15, fontWeight: "700" },
})
