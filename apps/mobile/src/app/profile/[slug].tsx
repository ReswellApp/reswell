import { Stack, useLocalSearchParams, useRouter } from "expo-router"
import { useEffect, useState } from "react"
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native"
import type { MobileListingCard, MobileProfile, MobileReview } from "@reswell/api-contract"
import { ListingCard } from "@/components/listing-card"
import { ProfileHeader } from "@/components/profile-header"
import { fetchProfile, fetchProfileListings, fetchProfileReviews, setFollow } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { fontFamily, useReswellColors } from "@/theme"

type Inventory = "current" | "sold"

export default function ProfileScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const colors = useReswellColors()
  const router = useRouter()
  const { session } = useAuth()
  const token = session?.access_token
  const [followBusy, setFollowBusy] = useState(false)
  const [followError, setFollowError] = useState<string | null>(null)
  const [profile, setProfile] = useState<MobileProfile | null>(null)
  const [listings, setListings] = useState<MobileListingCard[]>([])
  const [reviews, setReviews] = useState<MobileReview[]>([])
  const [inventory, setInventory] = useState<Inventory>("current")
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

  function showInventory(next: Inventory) {
    if (!slug || next === inventory) return
    setInventory(next)
    setLoadingListings(true)
    setListingsError(null)
    fetchProfileListings(slug, { status: next })
      .then((page) => setListings(page.listings))
      .catch((cause: unknown) => {
        setListings([])
        setListingsError(cause instanceof Error ? cause.message : "Unable to load listings")
      })
      .finally(() => setLoadingListings(false))
  }

  const grid = listings.length % 2 === 1 ? [...listings, null] : listings

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: profile?.name ?? "" }} />
      {!profile && !error ? (
        <ActivityIndicator style={styles.centered} color={colors.foreground} />
      ) : error && !profile ? (
        <Text style={[styles.centeredText, { color: colors.foreground, fontFamily: fontFamily.text }]}>{error}</Text>
      ) : profile ? (
        <FlatList
          data={grid}
          keyExtractor={(item) => item?.id ?? "spacer"}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View>
              <ProfileHeader profile={profile} followBusy={followBusy} onFollow={toggleFollow} />
              {followError ? (
                <Text style={[styles.empty, { color: colors.foreground, fontFamily: fontFamily.text }]}>{followError}</Text>
              ) : null}
              <View style={styles.switchRow}>
                <InventoryButton label="Listings" active={inventory === "current"} onPress={() => showInventory("current")} />
                <InventoryButton label="Sold" active={inventory === "sold"} onPress={() => showInventory("sold")} />
              </View>
              {loadingListings ? <ActivityIndicator color={colors.foreground} style={styles.listingsSpinner} /> : null}
              {listingsError ? (
                <Text style={[styles.empty, { color: colors.foreground, fontFamily: fontFamily.text }]}>{listingsError}</Text>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            loadingListings ? null : (
              <Text style={[styles.empty, { color: colors.muted, fontFamily: fontFamily.text }]}>
                {inventory === "sold" ? "No sold listings yet." : "No listings yet."}
              </Text>
            )
          }
          ListFooterComponent={
            inventory === "current" ? <Reviews reviews={reviews} /> : null
          }
          renderItem={({ item }) =>
            item ? (
              <ListingCard
                item={item}
                onPress={() =>
                  router.push({ pathname: "/listing/[id]", params: { id: item.slug || item.id } })
                }
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

function InventoryButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const colors = useReswellColors()
  return (
    <Pressable onPress={onPress} hitSlop={8}>
      <Text
        style={[
          styles.switchLabel,
          { color: active ? colors.foreground : colors.muted, fontFamily: fontFamily.text },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  )
}

function Reviews({ reviews }: { reviews: MobileReview[] }) {
  const colors = useReswellColors()
  return (
    <View style={styles.reviews}>
      <Text style={[styles.section, { color: colors.foreground, fontFamily: fontFamily.headline }]}>Reviews</Text>
      {reviews.length === 0 ? (
        <Text style={[styles.empty, { color: colors.muted, fontFamily: fontFamily.text }]}>No reviews yet.</Text>
      ) : (
        reviews.map((review) => (
          <View key={review.id} style={[styles.review, { borderColor: colors.border }]}>
            <Text style={[styles.reviewMeta, { color: colors.foreground, fontFamily: fontFamily.text }]}>
              {review.reviewer_name} · {review.rating} / 5
            </Text>
            {review.comment ? (
              <Text style={[styles.reviewBody, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                {review.comment}
              </Text>
            ) : null}
          </View>
        ))
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { marginTop: 48 },
  centeredText: { textAlign: "center", marginTop: 48, paddingHorizontal: 24 },
  list: { paddingBottom: 40 },
  row: { gap: 12, paddingHorizontal: 12 },
  spacer: { flex: 1 },
  switchRow: { flexDirection: "row", gap: 16, paddingHorizontal: 16, paddingBottom: 12 },
  switchLabel: { fontSize: 16, fontWeight: "600" },
  listingsSpinner: { marginVertical: 12 },
  empty: { textAlign: "center", marginTop: 12, marginBottom: 24, fontSize: 16 },
  reviews: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  section: { fontSize: 22, fontWeight: "700", letterSpacing: -0.4 },
  review: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, gap: 4 },
  reviewMeta: { fontSize: 15, fontWeight: "600" },
  reviewBody: { fontSize: 16, lineHeight: 22 },
})
