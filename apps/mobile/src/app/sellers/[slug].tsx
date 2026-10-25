import { Stack, useLocalSearchParams, useRouter } from "expo-router"
import { useEffect, useMemo, useState } from "react"
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native"
import type { MobileListingCard, MobileProfile, MobileReview } from "@reswell/api-contract"
import { ListingCard } from "@/components/listing-card"
import { ProfileFeedback, ProfileInfo } from "@/components/profile-panels"
import { ProfileHeader, type SellerTab } from "@/components/profile-header"
import { ScreenSearchHeader } from "@/components/screen-search-header"
import { fetchProfileListings, fetchProfileReviews, fetchSeller, setFollow } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useAuthGate } from "@/lib/auth-gate"
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
  const [profile, setProfile] = useState<MobileProfile | null>(null)
  const [listings, setListings] = useState<MobileListingCard[]>([])
  const [sold, setSold] = useState<MobileListingCard[] | null>(null)
  const [reviews, setReviews] = useState<MobileReview[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loadingListings, setLoadingListings] = useState(true)
  const [shopQuery, setShopQuery] = useState("")

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    setError(null)
    setLoadingListings(true)
    fetchSeller(slug, token)
      .then((page) => {
        if (!cancelled) {
          setProfile(page.profile)
          setListings(page.listings)
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load this seller")
      })
      .finally(() => {
        if (!cancelled) setLoadingListings(false)
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
    if (next !== "sold" || !slug || sold) return
    setLoadingListings(true)
    fetchProfileListings(slug, { status: "sold" })
      .then((page) => setSold(page.listings))
      .catch(() => setSold([]))
      .finally(() => setLoadingListings(false))
  }

  const inventory = tab === "sold" ? (sold ?? []) : listings
  const filteredInventory = useMemo(() => {
    const q = shopQuery.trim().toLowerCase()
    if (!q) return inventory
    return inventory.filter((item) => item.title.toLowerCase().includes(q))
  }, [inventory, shopQuery])
  const showingGrid = tab === "listings" || tab === "sold"
  const grid =
    showingGrid && filteredInventory.length % 2 === 1
      ? [...filteredInventory, null]
      : showingGrid
        ? filteredInventory
        : []
  const ownProfile = Boolean(session?.user.id && profile && session.user.id === profile.id)

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
          ListHeaderComponent={
            <View>
              <ProfileHeader
                profile={profile}
                tab={tab}
                onTab={showTab}
                ownProfile={ownProfile}
                followBusy={followBusy}
                onFollow={toggleFollow}
                onFollowers={ownProfile ? () => router.push("/account/followers") : undefined}
                onFollowing={ownProfile ? () => router.push("/account/following") : undefined}
                onEdit={ownProfile ? () => router.push("/account/profile") : undefined}
                shopQuery={shopQuery}
                onShopQueryChange={setShopQuery}
              />
              {followError ? (
                <Text style={[styles.empty, { color: colors.foreground, fontFamily: fontFamily.text }]}>{followError}</Text>
              ) : null}
              {showingGrid && loadingListings ? <ActivityIndicator color={colors.foreground} style={styles.listingsSpinner} /> : null}
            </View>
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
              <View>
                <ProfileInfo profile={profile} />
                <ProfileFeedback profile={profile} reviews={reviews} />
              </View>
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
