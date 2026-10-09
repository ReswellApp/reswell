import { Stack, useLocalSearchParams, useRouter } from "expo-router"
import { useEffect, useState } from "react"
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native"
import type { MobileListingCard, MobileProfile, MobileReview } from "@reswell/api-contract"
import { ListingCard } from "@/components/listing-card"
import { ProfileFeedback, ProfileInfo } from "@/components/profile-panels"
import { ProfileHeader, type SellerTab } from "@/components/profile-header"
import { fetchProfile, fetchProfileListings, fetchProfileReviews, setFollow } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { fontFamily, useReswellColors } from "@/theme"

export default function ProfileScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const colors = useReswellColors()
  const router = useRouter()
  const { session } = useAuth()
  const token = session?.access_token
  const [tab, setTab] = useState<SellerTab>("listings")
  const [followBusy, setFollowBusy] = useState(false)
  const [followError, setFollowError] = useState<string | null>(null)
  const [profile, setProfile] = useState<MobileProfile | null>(null)
  const [listings, setListings] = useState<MobileListingCard[]>([])
  const [sold, setSold] = useState<MobileListingCard[] | null>(null)
  const [reviews, setReviews] = useState<MobileReview[]>([])
  const [error, setError] = useState<string | null>(null)
  const [listingsError, setListingsError] = useState<string | null>(null)
  const [loadingListings, setLoadingListings] = useState(true)

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    setError(null)
    fetchProfile(slug, token)
      .then((next) => {
        if (!cancelled) setProfile(next)
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load profile")
      })
    fetchProfileListings(slug)
      .then((page) => {
        if (!cancelled) setListings(page.listings)
      })
      .catch((cause: unknown) => {
        if (!cancelled) setListingsError(cause instanceof Error ? cause.message : "Unable to load listings")
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
    if (!token) {
      router.push("/sign-in")
      return
    }
    const next = !profile.following
    setFollowBusy(true)
    setFollowError(null)
    setFollow(token, profile.id, next)
      .then((result) => {
        setProfile({ ...profile, following: result.following, follower_count: result.follower_count })
      })
      .catch((cause: unknown) => {
        setFollowError(cause instanceof Error ? cause.message : "Could not update this follow")
      })
      .finally(() => setFollowBusy(false))
  }

  function showTab(next: SellerTab) {
    setTab(next)
    if (next !== "sold" || !slug || sold) return
    setLoadingListings(true)
    setListingsError(null)
    fetchProfileListings(slug, { status: "sold" })
      .then((page) => setSold(page.listings))
      .catch((cause: unknown) => {
        setSold([])
        setListingsError(cause instanceof Error ? cause.message : "Unable to load listings")
      })
      .finally(() => setLoadingListings(false))
  }

  const inventory = tab === "sold" ? (sold ?? []) : listings
  const showingGrid = tab === "listings" || tab === "sold"
  const grid = showingGrid && inventory.length % 2 === 1 ? [...inventory, null] : showingGrid ? inventory : []
  const ownProfile = Boolean(session?.user.id && profile && session.user.id === profile.id)

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: "" }} />
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
              />
              {followError ? (
                <Text style={[styles.empty, { color: colors.foreground, fontFamily: fontFamily.text }]}>{followError}</Text>
              ) : null}
              {showingGrid && loadingListings ? <ActivityIndicator color={colors.foreground} style={styles.listingsSpinner} /> : null}
              {showingGrid && listingsError ? (
                <Text style={[styles.empty, { color: colors.foreground, fontFamily: fontFamily.text }]}>{listingsError}</Text>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            showingGrid ? (
              loadingListings ? null : (
                <Text style={[styles.empty, { color: colors.muted, fontFamily: fontFamily.text }]}>
                  {tab === "sold" ? "No sold listings yet." : "No listings yet."}
                </Text>
              )
            ) : tab === "feedback" ? (
              <ProfileFeedback profile={profile} reviews={reviews} />
            ) : (
              <ProfileInfo profile={profile} />
            )
          }
          renderItem={({ item }) =>
            item ? (
              <ListingCard
                item={item}
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
  row: { gap: 12, paddingHorizontal: 12, paddingTop: 16 },
  spacer: { flex: 1 },
  listingsSpinner: { marginVertical: 16 },
  empty: { textAlign: "center", marginTop: 12, marginBottom: 24, fontSize: 16 },
})
