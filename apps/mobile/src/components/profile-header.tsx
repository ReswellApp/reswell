import { Image } from "expo-image"
import { SymbolView } from "expo-symbols"
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import type { MobileProfile } from "@reswell/api-contract"
import { fontFamily, useReswellColors } from "@/theme"

export type SellerTab = "listings" | "feedback" | "info" | "sold"

const BANNER = "#04070E"
const BANNER_SKIP = new Set(["the", "official", "shop", "store", "a", "an", "and"])

function bannerMonogram(name: string): string {
  const words = name.split(/\s+/).filter(Boolean)
  const pick = words.find((word) => word.length >= 3 && !BANNER_SKIP.has(word.toLowerCase())) ?? words[0] ?? "S"
  return pick.slice(0, 6).toUpperCase()
}

export function ProfileHeader({
  profile,
  tab,
  onTab,
  ownProfile,
  followBusy,
  onFollow,
}: {
  profile: MobileProfile
  tab: SellerTab
  onTab: (tab: SellerTab) => void
  ownProfile: boolean
  followBusy?: boolean
  onFollow?: () => void
}) {
  const colors = useReswellColors()
  const tabs: { id: SellerTab; label: string }[] = [
    { id: "listings", label: `Listings (${profile.listing_count})` },
    { id: "feedback", label: `Feedback (${profile.review_count})` },
    { id: "info", label: "Info" },
  ]
  if (profile.sales_count > 0) tabs.push({ id: "sold", label: `Sold (${profile.sales_count})` })

  return (
    <View>
      <View style={styles.banner}>
        {profile.banner_url ? (
          <Image source={{ uri: profile.banner_url }} style={styles.bannerImage} contentFit="cover" />
        ) : (
          <Text style={[styles.monogram, { fontFamily: fontFamily.headline }]}>{bannerMonogram(profile.name)}</Text>
        )}
      </View>
      <View style={styles.identity}>
        {profile.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={[styles.avatar, { backgroundColor: colors.image, borderColor: colors.border }]} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.image, borderColor: colors.border }]}>
            <Text style={[styles.avatarLabel, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
              {profile.name.slice(0, 1).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.copy}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: colors.foreground, fontFamily: fontFamily.headline }]}>{profile.name}</Text>
            {ownProfile ? (
              <Text style={[styles.followers, { color: colors.muted, fontFamily: fontFamily.text }]}>
                {profile.follower_count} {profile.follower_count === 1 ? "follower" : "followers"}
              </Text>
            ) : (
              <Pressable
                onPress={onFollow}
                disabled={followBusy}
                style={[
                  styles.follow,
                  profile.following
                    ? { backgroundColor: colors.background, borderColor: colors.border }
                    : { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
              >
                {followBusy ? (
                  <ActivityIndicator color={profile.following ? colors.foreground : colors.primaryForeground} />
                ) : (
                  <Text
                    style={[
                      styles.followLabel,
                      {
                        color: profile.following ? colors.foreground : colors.primaryForeground,
                        fontFamily: fontFamily.text,
                      },
                    ]}
                  >
                    {profile.following ? "Following" : "Follow"}
                  </Text>
                )}
              </Pressable>
            )}
          </View>
          {profile.location_label ? (
            <View style={styles.location}>
              <SymbolView name={{ ios: "mappin", android: "location_on", web: "location_on" }} size={14} tintColor={colors.muted} />
              <Text style={[styles.locationText, { color: colors.muted, fontFamily: fontFamily.text }]}>{profile.location_label}</Text>
            </View>
          ) : null}
          {profile.verified ? (
            <View style={styles.verified}>
              <SymbolView name={{ ios: "checkmark.seal.fill", android: "verified", web: "verified" }} size={14} tintColor={colors.shipping} />
              <Text style={[styles.verifiedLabel, { color: colors.muted, fontFamily: fontFamily.text }]}>Verified</Text>
            </View>
          ) : null}
          <ContactRow website={profile.website_url} phone={profile.phone} />
        </View>
      </View>
      {profile.about ? (
        <Text style={[styles.about, { color: colors.muted, fontFamily: fontFamily.text }]}>{profile.about}</Text>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {tabs.map((item) => {
          const active = item.id === tab
          return (
            <Pressable key={item.id} onPress={() => onTab(item.id)} style={[styles.tab, { borderBottomColor: active ? colors.foreground : "transparent" }]}>
              <Text style={[styles.tabLabel, { color: active ? colors.foreground : colors.muted, fontFamily: fontFamily.text }]}>
                {item.label}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>
    </View>
  )
}

function ContactRow({ website, phone }: { website: string | null; phone: string | null }) {
  const colors = useReswellColors()
  if (!website && !phone) return null
  return (
    <View style={styles.contacts}>
      {website ? (
        <Pressable
          accessibilityLabel="Visit website"
          onPress={() => void Linking.openURL(website)}
          style={[styles.contact, { borderColor: colors.border }]}
        >
          <SymbolView name={{ ios: "globe", android: "public", web: "public" }} size={14} tintColor={colors.foreground} />
        </Pressable>
      ) : null}
      {phone ? (
        <Pressable
          accessibilityLabel="Call seller"
          onPress={() => void Linking.openURL(`tel:${phone}`)}
          style={[styles.contact, { borderColor: colors.border }]}
        >
          <SymbolView name={{ ios: "phone", android: "call", web: "call" }} size={14} tintColor={colors.foreground} />
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  banner: { height: 120, backgroundColor: BANNER, alignItems: "center", justifyContent: "center" },
  bannerImage: { width: "100%", height: "100%" },
  monogram: { color: "#FFFFFF", fontSize: 28, fontWeight: "700", letterSpacing: 1 },
  identity: { flexDirection: "row", gap: 14, paddingHorizontal: 16, paddingTop: 16 },
  avatar: { width: 72, height: 72, borderRadius: 36, borderWidth: StyleSheet.hairlineWidth },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarLabel: { fontSize: 28, fontWeight: "700" },
  copy: { flex: 1, gap: 6, paddingTop: 2 },
  nameRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10 },
  name: { fontSize: 22, fontWeight: "700", letterSpacing: -0.4 },
  followers: { fontSize: 14 },
  follow: { minHeight: 32, borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  followLabel: { fontSize: 13, fontWeight: "600" },
  location: { flexDirection: "row", alignItems: "center", gap: 4 },
  locationText: { flex: 1, fontSize: 14 },
  verified: { flexDirection: "row", alignItems: "center", gap: 4 },
  verifiedLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 0.6, textTransform: "uppercase" },
  contacts: { flexDirection: "row", gap: 8, marginTop: 2 },
  contact: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  about: { paddingHorizontal: 16, paddingTop: 16, fontSize: 15, lineHeight: 22 },
  tabs: { paddingHorizontal: 16, gap: 20, marginTop: 20 },
  tab: { borderBottomWidth: 2, paddingBottom: 12 },
  tabLabel: { fontSize: 15, fontWeight: "600" },
})
