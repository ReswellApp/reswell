import { Image } from "expo-image"
import { SymbolView } from "expo-symbols"
import { Linking, Pressable, StyleSheet, Text, View } from "react-native"
import { fontFamily, useReswellColors } from "@/theme"

export function MeProfileHeader({
  displayName,
  username,
  avatarUrl,
  initials,
  about,
  websiteUrl,
  onSellerProfile,
  sellerProfileLabel,
}: {
  displayName: string
  username: string | null
  avatarUrl: string | null
  initials: string
  about: string | null
  websiteUrl: string | null
  onSellerProfile?: () => void
  sellerProfileLabel?: string
}) {
  const colors = useReswellColors()
  return (
    <View>
      <View style={styles.identity}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={[styles.avatar, { backgroundColor: colors.image }]} />
        ) : (
          <View style={[styles.avatar, styles.initials, { backgroundColor: colors.primary }]}>
            <Text style={[styles.initialsLabel, { color: colors.primaryForeground, fontFamily: fontFamily.headline }]}>{initials}</Text>
          </View>
        )}
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
      {about ? <Text style={[styles.about, { color: colors.muted, fontFamily: fontFamily.text }]}>{about}</Text> : null}
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
  avatar: { width: 72, height: 72, borderRadius: 36 },
  initials: { alignItems: "center", justifyContent: "center" },
  initialsLabel: { fontSize: 24, fontWeight: "700" },
  identityCopy: { flex: 1, gap: 2 },
  displayName: { fontSize: 22, fontWeight: "700", lineHeight: 28 },
  handle: { fontSize: 15, fontWeight: "600" },
  storefront: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  storefrontLabel: { fontSize: 15, fontWeight: "700" },
  about: { paddingHorizontal: 16, paddingTop: 16, fontSize: 15, lineHeight: 21 },
  website: { paddingHorizontal: 16, paddingTop: 6, fontSize: 15, fontWeight: "700" },
})
