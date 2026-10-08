import { Image } from "expo-image"
import { SymbolView } from "expo-symbols"
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native"
import type { MobileProfile } from "@reswell/api-contract"
import { fontFamily, useReswellColors } from "@/theme"

export function ProfileHeader({
  profile,
  followBusy,
  onFollow,
}: {
  profile: MobileProfile
  followBusy?: boolean
  onFollow?: () => void
}) {
  const colors = useReswellColors()
  const website = profile.website_url

  return (
    <View style={styles.header}>
      {profile.avatar_url ? (
        <Image source={{ uri: profile.avatar_url }} style={[styles.avatar, { backgroundColor: colors.image }]} />
      ) : (
        <View style={[styles.avatar, { backgroundColor: colors.image }]} />
      )}
      <View style={styles.nameRow}>
        <Text style={[styles.name, { color: colors.foreground, fontFamily: fontFamily.headline }]}>{profile.name}</Text>
        {profile.verified ? <SymbolView name="checkmark.seal.fill" size={18} tintColor={colors.shipping} /> : null}
      </View>
      {profile.location_label ? (
        <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>{profile.location_label}</Text>
      ) : null}
      <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>
        Member since {profile.member_since_label}
      </Text>
      <Text style={[styles.stats, { color: colors.foreground, fontFamily: fontFamily.text }]}>
        {profile.listing_count} listings · {profile.sales_count} sold · {profile.follower_count} followers
        {profile.review_count > 0 ? ` · ${profile.rating_average.toFixed(1)}` : ""}
      </Text>
      {profile.about ? (
        <Text style={[styles.about, { color: colors.foreground, fontFamily: fontFamily.text }]}>{profile.about}</Text>
      ) : null}
      {onFollow ? (
        <Pressable onPress={onFollow} style={[styles.follow, { backgroundColor: colors.primary }]}>
          {followBusy ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={[styles.followLabel, { color: colors.primaryForeground, fontFamily: fontFamily.text }]}>
              {profile.following ? "Following" : "Follow"}
            </Text>
          )}
        </Pressable>
      ) : null}
      {website ? (
        <Pressable onPress={() => void Linking.openURL(website)}>
          <Text style={[styles.link, { color: colors.shipping, fontFamily: fontFamily.text }]}>Website</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 20, gap: 6 },
  avatar: { width: 72, height: 72, borderRadius: 36, marginBottom: 8 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { fontSize: 28, fontWeight: "700", letterSpacing: -0.6 },
  meta: { fontSize: 15 },
  stats: { marginTop: 8, fontSize: 15, fontWeight: "600" },
  about: { marginTop: 8, fontSize: 16, lineHeight: 24 },
  link: { marginTop: 4, fontSize: 16, fontWeight: "600" },
  follow: { alignSelf: "flex-start", marginTop: 8, minHeight: 40, borderRadius: 8, paddingHorizontal: 16, justifyContent: "center" },
  followLabel: { fontSize: 16, fontWeight: "600" },
})
