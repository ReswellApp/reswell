import { Image } from "expo-image"
import { SymbolView } from "expo-symbols"
import { Linking, Pressable, StyleSheet, Text, View } from "react-native"
import { fontFamily, useReswellColors } from "@/theme"

export type MeTab = "shop" | "sold" | "purchases" | "likes"

const TABS: { id: MeTab; label: string }[] = [
  { id: "shop", label: "Shop" },
  { id: "sold", label: "Sold" },
  { id: "purchases", label: "Purchases" },
  { id: "likes", label: "Likes" },
]

export function MeProfileHeader({
  username,
  avatarUrl,
  initials,
  about,
  websiteUrl,
  followerCount,
  followingCount,
  reviewCount,
  listingCount,
  showEarnings,
  tab,
  onTab,
  onSell,
  onMenu,
  onFollowing,
  onFollowers,
  onReviews,
  onEarnings,
  availableLabel,
}: {
  username: string
  avatarUrl: string | null
  initials: string
  about: string | null
  websiteUrl: string | null
  followerCount: number
  followingCount: number
  reviewCount: number
  listingCount: number
  /** Hide the available chip when this account has no shop and nothing to cash out. */
  showEarnings: boolean
  tab: MeTab
  onTab: (tab: MeTab) => void
  onSell: () => void
  onMenu: () => void
  onFollowing: () => void
  onFollowers: () => void
  onReviews: () => void
  onEarnings: () => void
  availableLabel: string
}) {
  const colors = useReswellColors()
  return (
    <View>
      <View style={styles.top}>
        <View style={styles.topSide} />
        <Text numberOfLines={1} style={[styles.username, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
          {username}
        </Text>
        <View style={styles.topActions}>
          <Pressable accessibilityLabel="Sell" onPress={onSell} hitSlop={8}>
            <SymbolView name={{ ios: "plus", android: "add", web: "add" }} size={26} tintColor={colors.foreground} />
          </Pressable>
          <Pressable accessibilityLabel="Account menu" onPress={onMenu} hitSlop={8}>
            <SymbolView name={{ ios: "line.3.horizontal", android: "menu", web: "menu" }} size={22} tintColor={colors.foreground} />
          </Pressable>
        </View>
      </View>
      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        {TABS.map((item) => {
          const active = item.id === tab
          return (
            <Pressable key={item.id} onPress={() => onTab(item.id)} style={[styles.tab, { borderBottomColor: active ? colors.foreground : "transparent" }]}>
              <Text style={[styles.tabLabel, { color: active ? colors.foreground : colors.muted, fontFamily: fontFamily.text }]}>
                {item.label}
              </Text>
            </Pressable>
          )
        })}
      </View>
      <View style={styles.identity}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={[styles.avatar, { backgroundColor: colors.image }]} />
        ) : (
          <View style={[styles.avatar, styles.initials, { backgroundColor: colors.primary }]}>
            <Text style={[styles.initialsLabel, { color: colors.primaryForeground, fontFamily: fontFamily.headline }]}>{initials}</Text>
          </View>
        )}
        <View style={styles.stats}>
          <Stat value={String(followerCount)} label="followers" onPress={onFollowers} />
          <Stat value={String(followingCount)} label="following" onPress={onFollowing} />
          <Stat
            label={reviewCount === 0 ? "no reviews" : reviewCount === 1 ? "1 review" : `${reviewCount} reviews`}
            icon
            onPress={onReviews}
          />
        </View>
      </View>
      {showEarnings ? (
        <Pressable onPress={onEarnings} style={[styles.earnings, { backgroundColor: colors.image }]}>
          <SymbolView name={{ ios: "chart.bar", android: "bar_chart", web: "bar_chart" }} size={14} tintColor={colors.foreground} />
          <Text style={[styles.earningsLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>Available {availableLabel}</Text>
        </Pressable>
      ) : null}
      {about ? <Text style={[styles.about, { color: colors.muted, fontFamily: fontFamily.text }]}>{about}</Text> : null}
      {websiteUrl ? (
        <Pressable onPress={() => void Linking.openURL(websiteUrl)}>
          <Text style={[styles.website, { color: colors.foreground, fontFamily: fontFamily.text }]}>{websiteUrl}</Text>
        </Pressable>
      ) : null}
      {tab === "shop" && listingCount > 0 ? (
        <Text style={[styles.active, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
          Active ({listingCount} {listingCount === 1 ? "listing" : "listings"})
        </Text>
      ) : null}
    </View>
  )
}

function Stat({ value, label, icon, onPress }: { value?: string; label: string; icon?: boolean; onPress?: () => void }) {
  const colors = useReswellColors()
  const body = (
    <View style={styles.stat}>
      {icon ? (
        <SymbolView name={{ ios: "star", android: "star", web: "star" }} size={18} tintColor={colors.foreground} />
      ) : (
        <Text style={[styles.statValue, { color: colors.foreground, fontFamily: fontFamily.headline }]}>{value}</Text>
      )}
      <Text style={[styles.statLabel, { color: colors.muted, fontFamily: fontFamily.text }]}>{label}</Text>
    </View>
  )
  if (!onPress) return body
  return <Pressable onPress={onPress}>{body}</Pressable>
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 8 },
  topSide: { width: 72 },
  username: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700" },
  topActions: { width: 72, flexDirection: "row", justifyContent: "flex-end", gap: 16 },
  tabs: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, alignItems: "center", borderBottomWidth: 2, paddingVertical: 12 },
  tabLabel: { fontSize: 14, fontWeight: "700" },
  identity: { flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 16, paddingTop: 20 },
  avatar: { width: 84, height: 84, borderRadius: 42 },
  initials: { alignItems: "center", justifyContent: "center" },
  initialsLabel: { fontSize: 28, fontWeight: "700" },
  stats: { flex: 1, flexDirection: "row", justifyContent: "space-around" },
  stat: { alignItems: "center", gap: 2, minWidth: 72 },
  statValue: { fontSize: 18, fontWeight: "700" },
  statLabel: { fontSize: 13 },
  earnings: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginLeft: 16,
    marginTop: 12,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  earningsLabel: { fontSize: 13, fontWeight: "600" },
  about: { paddingHorizontal: 16, paddingTop: 16, fontSize: 15, lineHeight: 21 },
  website: { paddingHorizontal: 16, paddingTop: 6, fontSize: 15, fontWeight: "700" },
  active: { paddingHorizontal: 16, paddingTop: 22, fontSize: 16, fontWeight: "700" },
})
