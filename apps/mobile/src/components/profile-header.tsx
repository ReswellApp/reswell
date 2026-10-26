import { Image, type ImageContentPosition } from "expo-image"
import { ProfileCircle } from "@/components/profile-circle"
import { SymbolView } from "expo-symbols"
import { ActivityIndicator, Linking, Pressable, Share, StyleSheet, Text, View } from "react-native"
import type { MobileProfile } from "@reswell/api-contract"
import { ProfileSegmentTabs } from "@/components/profile-segment-tabs"
import { ProfileShopToolbar } from "@/components/profile-shop-toolbar"
import { ProfileStatsRow } from "@/components/profile-stats-row"
import { publicSiteUrl } from "@/lib/public-env"
import { fontFamily, useReswellColors } from "@/theme"

export type SellerTab = "listings" | "feedback" | "info" | "sold"

function bannerContentPosition(focalX: number, focalY: number): ImageContentPosition {
  return { left: `${focalX}%`, top: `${focalY}%` }
}

export function ProfileHeader({
  profile,
  tab,
  onTab,
  ownProfile,
  followBusy,
  onFollow,
  onFollowers,
  onFollowing,
  onEdit,
  shopQuery,
  onShopQueryChange,
}: {
  profile: MobileProfile
  tab: SellerTab
  onTab: (tab: SellerTab) => void
  ownProfile: boolean
  followBusy?: boolean
  onFollow?: () => void
  onFollowers?: () => void
  onFollowing?: () => void
  onEdit?: () => void
  shopQuery?: string
  onShopQueryChange?: (value: string) => void
}) {
  const colors = useReswellColors()
  const handle = `@${profile.seller_slug}`
  const segmentTabs: { id: SellerTab; label: string }[] = [
    { id: "listings", label: "Shop" },
    { id: "info", label: "About" },
  ]
  if (profile.sales_count > 0) segmentTabs.push({ id: "sold", label: "Sold" })

  const activeSegment: SellerTab =
    tab === "feedback" ? "info" : segmentTabs.some((item) => item.id === tab) ? tab : "listings"

  function shareProfile() {
    const url = `${publicSiteUrl().replace(/\/$/, "")}/sellers/${profile.seller_slug}`
    void Share.share({ message: `${profile.name} on Reswell\n${url}`, url })
  }

  const showShopToolbar = (tab === "listings" || tab === "sold") && onShopQueryChange

  return (
    <View style={styles.wrap}>
      <View style={[styles.hero, { backgroundColor: colors.sellerProfileBannerDefault }]}>
        {profile.banner_url ? (
          <>
            <Image
              source={{ uri: profile.banner_url }}
              style={styles.heroMedia}
              contentFit="cover"
              contentPosition={bannerContentPosition(profile.banner_focal_x, profile.banner_focal_y)}
              pointerEvents="none"
            />
            <View pointerEvents="none" style={styles.heroOverlay} />
          </>
        ) : null}
        <View style={styles.heroActions}>
          {ownProfile && onEdit ? (
            <Pressable accessibilityLabel="Edit profile" onPress={onEdit} style={styles.iconCircle} hitSlop={8}>
              <SymbolView name={{ ios: "pencil", android: "edit", web: "edit" }} size={16} tintColor="#FFFFFF" />
            </Pressable>
          ) : null}
          <Pressable accessibilityLabel="Share profile" onPress={shareProfile} style={styles.iconCircle} hitSlop={8}>
            <SymbolView name={{ ios: "square.and.arrow.up", android: "share", web: "share" }} size={16} tintColor="#FFFFFF" />
          </Pressable>
        </View>
        <View style={styles.heroIdentity}>
          <ProfileCircle url={profile.avatar_url} size={72} style={styles.heroAvatar} />
          <View style={styles.heroCopy}>
            <Text style={[styles.heroName, { fontFamily: fontFamily.headline }]} numberOfLines={2}>
              {profile.name}
            </Text>
            <Text style={[styles.heroHandle, { fontFamily: fontFamily.text }]} numberOfLines={1}>
              {handle}
            </Text>
            {profile.verified ? (
              <View style={styles.verifiedRow}>
                <SymbolView name={{ ios: "checkmark.seal.fill", android: "verified", web: "verified" }} size={12} tintColor="#FFFFFF" />
                <Text style={[styles.verifiedLabel, { fontFamily: fontFamily.text }]}>Verified shop</Text>
              </View>
            ) : null}
            {!ownProfile ? (
              <Pressable
                onPress={onFollow}
                disabled={followBusy}
                style={[styles.follow, profile.following ? styles.followActive : null]}
              >
                {followBusy ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={[styles.followLabel, { fontFamily: fontFamily.text }]}>
                    {profile.following ? "Following" : "Follow"}
                  </Text>
                )}
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <ProfileSegmentTabs tabs={segmentTabs} active={activeSegment} onChange={onTab} />
      </View>

      <View style={styles.section}>
        <ProfileStatsRow
          listingCount={profile.listing_count}
          followerCount={profile.follower_count}
          followingCount={ownProfile ? profile.following_count : undefined}
          onListings={() => onTab("listings")}
          onFollowers={onFollowers}
          onFollowing={onFollowing}
        />
      </View>

      {showShopToolbar ? (
        <View style={styles.section}>
          <ProfileShopToolbar
            sellerName={profile.name}
            query={shopQuery ?? ""}
            onQueryChange={onShopQueryChange}
          />
        </View>
      ) : null}

      {tab === "info" && profile.about ? (
        <Text style={[styles.about, { color: colors.muted, fontFamily: fontFamily.text }]}>{profile.about}</Text>
      ) : null}

      {tab === "info" ? <ContactRow website={profile.website_url} phone={profile.phone} /> : null}
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
  wrap: { paddingBottom: 4 },
  hero: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 16,
    overflow: "hidden",
    padding: 16,
    minHeight: 148,
  },
  heroMedia: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  heroOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(4, 7, 14, 0.45)",
  },
  heroActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginBottom: 12 },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.22)",
  },
  heroIdentity: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  heroAvatar: {
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  heroCopy: { flex: 1, gap: 4, paddingTop: 4 },
  heroName: { color: "#FFFFFF", fontSize: 22, fontWeight: "700", letterSpacing: -0.3 },
  heroHandle: { color: "rgba(255, 255, 255, 0.88)", fontSize: 15, fontWeight: "600" },
  verifiedRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  verifiedLabel: { color: "rgba(255, 255, 255, 0.92)", fontSize: 12, fontWeight: "600" },
  follow: {
    alignSelf: "flex-start",
    marginTop: 6,
    minHeight: 32,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#FFFFFF",
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  followActive: { backgroundColor: "rgba(255, 255, 255, 0.2)" },
  followLabel: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  section: { paddingHorizontal: 16, paddingTop: 14 },
  about: { paddingHorizontal: 16, paddingTop: 12, fontSize: 15, lineHeight: 22 },
  contacts: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 },
  contact: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center" },
})
