import { Stack, useLocalSearchParams, useRouter } from "expo-router"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native"
import type { MobileProfile, MobileReview } from "@reswell/api-contract"
import { ListingCard } from "@/components/listing-card"
import { ProfileInfo } from "@/components/profile-panels"
import { ProfileHeader, type SellerTab } from "@/components/profile-header"
import { ProfileReviewsSheet } from "@/components/profile-reviews-sheet"
import { ScreenSearchHeader } from "@/components/screen-search-header"
import { fetchProfile, fetchProfileReviews, openProfileConversation, setFollow } from "@/lib/api"
import { useProfileShopListings } from "@/lib/use-profile-shop-listings"
import { useAuth } from "@/lib/auth-context"
import { useAuthGate } from "@/lib/auth-gate"
import { sortProfileShopListings, type ProfileShopSort } from "@/lib/profile-shop-sort"
import { fontFamily, useReswellColors } from "@/theme"

export default function SellerScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const colors = useReswellColors()
  const router = useRouter()
  const { session } = useAuth()
  const { requestAuth } = useAuthGate()
  const token = session?.access_token
  const [tab, setTab] = useState<SellerTab>("listings")
  const [followBusy, setFollowBusy] = useState(false)
  const [followError, setFollowError] = useState<string | null>(null)
  const [messageError, setMessageError] = useState<string | null>(null)
  const [profile, setProfile] = useState<MobileProfile | null>(null)
  const [reviews, setReviews] = useState<MobileReview[]>([])
  const [error, setError] = useState<string | null>(null)
  const [shopQuery, setShopQuery] = useState("")
  const [shopSort, setShopSort] = useState<ProfileShopSort>("newest")
  const [reviewsOpen, setReviewsOpen] = useState(false)
  const shopTab = tab === "sold" ? "sold" : "listings"
  const shop = useProfileShopListings(slug, shopTab)

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    setError(null)
    fetchProfile(slug, token)
      .then((next) => {
        if (!cancelled) setProfile(next)
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load this seller")
      })
    fetchProfileReviews(slug)
      .then((page) => {
        if (!cancelled) setReviews(page.reviews)
      })
      .catch(() => {
        if (!cancelled) setReviews([])
      })
    return () => {
      cancelled = true
    }
  }, [slug, token])

  function openMessage() {
    if (!profile) return
    requestAuth((accessToken) => {
      setMessageError(null)
      void openProfileConversation(accessToken, profile.seller_slug)
        .then((result) => router.push({ pathname: "/account/messages/[id]", params: { id: result.conversation_id } }))
        .catch((cause: unknown) => {
          setMessageError(cause instanceof Error ? cause.message : "Could not open messages")
        })
    })
  }

  function toggleFollow() {
    if (!profile) return
    requestAuth((accessToken) => {
      const next = !profile.following
      setFollowBusy(true)
      setFollowError(null)
      setFollow(accessToken, profile.id, next)
        .then((result) => {
          setProfile({ ...profile, following: result.following, follower_count: result.follower_count })
        })
        .catch((cause: unknown) => {
          setFollowError(cause instanceof Error ? cause.message : "Could not update this follow")
        })
        .finally(() => setFollowBusy(false))
    })
  }

  function showTab(next: SellerTab) {
    setTab(next)
    if (next === "sold") shop.loadSold()
  }

  const loadingListings = tab === "sold" ? shop.loadingSold : shop.loadingCurrent
  const inventory = tab === "sold" ? (shop.soldListings ?? []) : shop.currentListings
  const filteredInventory = useMemo(() => {
    const q = shopQuery.trim().toLowerCase()
    const searched = q ? inventory.filter((item) => item.title.toLowerCase().includes(q)) : inventory
    return sortProfileShopListings(searched, shopSort, shop.sectionId)
  }, [inventory, shopQuery, shopSort, shop.sectionId])
  const showingGrid = tab === "listings" || tab === "sold"
  const grid =
    showingGrid && filteredInventory.length % 2 === 1
      ? [...filteredInventory, null]
      : showingGrid
        ? filteredInventory
        : []
  const ownProfile = Boolean(session?.user.id && profile && session.user.id === profile.id)
  const loadMore = useCallback(() => {
    if (!showingGrid || loadingListings) return
    shop.loadMore(tab === "sold" ? "sold" : "current")
  }, [loadingListings, shop.loadMore, showingGrid, tab])

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenSearchHeader showBack showInbox bordered={false} />
      {!profile && !error ? (
        <ActivityIndicator style={styles.centered} color={colors.foreground} />
      ) : error && !profile ? (
        <Text style={[styles.centeredText, { color: colors.foreground, fontFamily: fontFamily.text }]}>{error}</Text>
      ) : profile ? (
        <FlatList
          data={grid}
          extraData={tab}
          keyExtractor={(item) => item?.id ?? "spacer"}
          numColumns={2}
          columnWrapperStyle={grid.length > 0 ? styles.row : undefined}
          contentContainerStyle={styles.list}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListHeaderComponent={
            <View>
              <ProfileHeader
                profile={profile}
                tab={tab}
                onTab={showTab}
                ownProfile={ownProfile}
                followBusy={followBusy}
                onFollow={toggleFollow}
                onMessage={ownProfile ? undefined : openMessage}
                onFollowers={ownProfile ? () => router.push("/account/followers") : undefined}
                onFollowing={ownProfile ? () => router.push("/account/following") : undefined}
                onEdit={ownProfile ? () => router.push("/account/profile") : undefined}
                shopQuery={shopQuery}
                onShopQueryChange={setShopQuery}
                shopSections={shop.sectionOptions}
                shopSectionId={shop.sectionId}
                onShopSectionChange={shop.setSectionId}
                shopSort={shopSort}
                onShopSortChange={setShopSort}
                onReviewsPress={() => setReviewsOpen(true)}
              />
              {followError ? (
                <Text style={[styles.empty, { color: colors.foreground, fontFamily: fontFamily.text }]}>{followError}</Text>
              ) : null}
              {messageError ? (
                <Text style={[styles.empty, { color: colors.foreground, fontFamily: fontFamily.text }]}>{messageError}</Text>
              ) : null}
              {showingGrid && shop.error ? (
                <Text style={[styles.empty, { color: colors.foreground, fontFamily: fontFamily.text }]}>{shop.error}</Text>
              ) : null}
              {showingGrid && loadingListings && inventory.length === 0 ? (
                <ActivityIndicator color={colors.foreground} style={styles.listingsSpinner} />
              ) : null}
            </View>
          }
          ListFooterComponent={
            showingGrid && shop.loadingMore ? (
              <ActivityIndicator color={colors.foreground} style={styles.listingsSpinner} />
            ) : null
          }
          ListEmptyComponent={
            showingGrid ? (
              loadingListings ? null : (
                <Text style={[styles.empty, { color: colors.muted, fontFamily: fontFamily.text }]}>
                  {tab === "sold"
                    ? "No sold listings yet."
                    : shopQuery.trim()
                      ? "No listings match your search."
                      : "No listings yet."}
                </Text>
              )
            ) : tab === "info" ? (
              <ProfileInfo profile={profile} />
            ) : null
          }
          renderItem={({ item }) =>
            item ? (
              <ListingCard
                item={item}
                badge={tab === "sold" ? "Sold" : undefined}
                onPress={() => router.push({ pathname: "/listing/[id]", params: { id: item.slug || item.id } })}
              />
            ) : (
              <View style={styles.spacer} />
            )
          }
        />
      ) : null}
      {profile ? (
        <ProfileReviewsSheet
          profile={profile}
          reviews={reviews}
          visible={reviewsOpen}
          onClose={() => setReviewsOpen(false)}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { marginTop: 48 },
  centeredText: { textAlign: "center", marginTop: 48, paddingHorizontal: 24 },
  list: { paddingBottom: 40 },
  row: { gap: 12, paddingHorizontal: 12, paddingTop: 8 },
  spacer: { flex: 1 },
  listingsSpinner: { marginVertical: 16 },
  empty: { textAlign: "center", marginTop: 12, marginBottom: 24, fontSize: 16 },
})
