import { Stack, useRouter } from "expo-router"
import { useCallback, useEffect, useState } from "react"
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import type { MobileListingCard, MobileOrder } from "@reswell/api-contract"
import { AccountRow } from "@/components/account-row"
import { ListingCard } from "@/components/listing-card"
import { MeProfileHeader, type MeTab } from "@/components/me-profile-header"
import { fetchDashboard, fetchFavorites, fetchProfileListings, fetchPurchases } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useAccountResource } from "@/lib/use-account-resource"
import { fontFamily, useReswellColors } from "@/theme"

export default function AccountScreen() {
  const colors = useReswellColors()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { session } = useAuth()
  const token = session?.access_token
  const loadDashboard = useCallback((accessToken: string) => fetchDashboard(accessToken), [])
  const dashboardResource = useAccountResource(loadDashboard)
  const [tab, setTab] = useState<MeTab>("shop")
  const [shop, setShop] = useState<MobileListingCard[]>([])
  const [sold, setSold] = useState<MobileListingCard[] | null>(null)
  const [likes, setLikes] = useState<MobileListingCard[] | null>(null)
  const [purchases, setPurchases] = useState<MobileOrder[] | null>(null)
  const [inventoryError, setInventoryError] = useState<string | null>(null)
  const [shopLoaded, setShopLoaded] = useState(false)

  const dashboard = dashboardResource.data
  const slug = dashboard?.seller_slug ?? null

  useEffect(() => {
    if (!slug) {
      setShop([])
      setShopLoaded(true)
      return
    }
    let cancelled = false
    setShopLoaded(false)
    setInventoryError(null)
    fetchProfileListings(slug)
      .then((page) => {
        if (!cancelled) setShop(page.listings)
      })
      .catch((cause: unknown) => {
        if (!cancelled) setInventoryError(cause instanceof Error ? cause.message : "Unable to load listings")
      })
      .finally(() => {
        if (!cancelled) setShopLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [slug, token])

  function showTab(next: MeTab) {
    setTab(next)
    if (next === "sold" && slug && !sold) {
      fetchProfileListings(slug, { status: "sold" })
        .then((page) => setSold(page.listings))
        .catch(() => setSold([]))
    }
    if (next === "likes" && token && !likes) {
      fetchFavorites(token)
        .then((page) => setLikes(page.favorites.map((item) => item.listing)))
        .catch(() => setLikes([]))
    }
    if (next === "purchases" && token && !purchases) {
      fetchPurchases(token)
        .then((page) => setPurchases(page.orders))
        .catch(() => setPurchases([]))
    }
  }

  if (!token) {
    return (
      <View style={[styles.screen, styles.signedOut, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={[styles.signedOutTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>Sign in</Text>
        <Pressable onPress={() => router.push("/sign-in")} style={[styles.sell, { backgroundColor: colors.primary }]}>
          <Text style={[styles.sellLabel, { color: colors.primaryForeground, fontFamily: fontFamily.text }]}>Sign in</Text>
        </Pressable>
      </View>
    )
  }

  const name = dashboard?.display_name || "Account"
  const listings = tab === "sold" ? (sold ?? []) : tab === "likes" ? (likes ?? []) : shop
  const grid: Array<MobileListingCard | null> = listings.length % 2 === 1 ? [...listings, null] : listings
  const header = (
    <MeProfileHeader
      username={slug || name}
      avatarUrl={dashboard?.avatar_url ?? null}
      initials={initials(name)}
      about={dashboard?.about ?? null}
      websiteUrl={dashboard?.website_url ?? null}
      followerCount={dashboard?.follower_count ?? 0}
      followingCount={dashboard?.following_count ?? 0}
      reviewCount={dashboard?.review_count ?? 0}
      listingCount={dashboard?.active_listing_count ?? shop.length}
      tab={tab}
      onTab={showTab}
      onSell={() => router.push("/sell")}
      onMenu={() => router.push("/account/menu")}
      onFollowers={() => router.push("/account/followers")}
      onFollowing={() => router.push("/account/following")}
      onEarnings={() => router.push("/account/sales")}
      earningsLabel={dashboard?.earnings_lifetime_label ?? "Earnings"}
    />
  )
  const empty = (
    <EmptyTab
      tab={tab}
      error={inventoryError}
      loading={tab === "shop" ? !shopLoaded : tab === "sold" ? sold === null : tab === "likes" ? likes === null : purchases === null}
      onSell={() => router.push("/sell")}
    />
  )

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      {dashboardResource.error && !dashboard ? (
        <Text style={[styles.emptyBody, { color: colors.foreground, fontFamily: fontFamily.text }]}>{dashboardResource.error}</Text>
      ) : dashboardResource.loading && !dashboard ? (
        <ActivityIndicator style={styles.centered} color={colors.foreground} />
      ) : tab === "purchases" ? (
        <FlatList
          data={purchases ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={header}
          ListEmptyComponent={empty}
          renderItem={({ item }) => {
            const listingId = item.listing_id
            return (
              <AccountRow
                title={item.listing_title}
                subtitle={`${item.status_label} · ${item.counterparty_name}`}
                meta={item.amount_label}
                imageUrl={item.listing_image_url}
                onPress={listingId ? () => router.push({ pathname: "/listing/[id]", params: { id: listingId } }) : undefined}
              />
            )
          }}
        />
      ) : (
        <FlatList
          data={grid}
          keyExtractor={(item, index) => item?.id ?? `spacer-${index}`}
          numColumns={2}
          columnWrapperStyle={grid.length > 0 ? styles.row : undefined}
          contentContainerStyle={styles.list}
          ListHeaderComponent={header}
          ListEmptyComponent={empty}
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
      )}
    </View>
  )
}

function EmptyTab({ tab, error, loading, onSell }: { tab: MeTab; error: string | null; loading: boolean; onSell: () => void }) {
  const colors = useReswellColors()
  if (loading) return <ActivityIndicator color={colors.foreground} style={styles.centered} />
  if (error && tab === "shop") {
    return <Text style={[styles.emptyBody, { color: colors.muted, fontFamily: fontFamily.text }]}>{error}</Text>
  }
  if (tab === "shop") {
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>No active listings</Text>
        <Text style={[styles.emptyBody, { color: colors.muted, fontFamily: fontFamily.text }]}>
          List an item so buyers can discover your shop.
        </Text>
        <Pressable onPress={onSell} style={[styles.sell, { backgroundColor: colors.primary }]}>
          <Text style={[styles.sellLabel, { color: colors.primaryForeground, fontFamily: fontFamily.text }]}>Start selling</Text>
        </Pressable>
      </View>
    )
  }
  const copy = tab === "sold" ? "No sold listings yet." : tab === "likes" ? "No liked listings yet." : "No purchases yet."
  return <Text style={[styles.emptyBody, { color: colors.muted, fontFamily: fontFamily.text }]}>{copy}</Text>
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "")
  return letters.join("") || "R"
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  signedOut: { justifyContent: "center", paddingHorizontal: 24, gap: 16 },
  signedOutTitle: { fontSize: 32, fontWeight: "700" },
  list: { paddingBottom: 120 },
  row: { gap: 12, paddingHorizontal: 12, paddingTop: 16 },
  spacer: { flex: 1 },
  centered: { marginTop: 24 },
  empty: { alignItems: "center", paddingHorizontal: 32, paddingTop: 36, gap: 8 },
  emptyTitle: { fontSize: 20, fontWeight: "700" },
  emptyBody: { textAlign: "center", fontSize: 15, lineHeight: 21, marginTop: 8 },
  sell: { marginTop: 12, borderRadius: 999, paddingHorizontal: 22, minHeight: 44, alignItems: "center", justifyContent: "center" },
  sellLabel: { fontSize: 16, fontWeight: "700" },
})
