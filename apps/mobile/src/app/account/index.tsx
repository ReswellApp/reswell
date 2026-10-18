import { Stack, useRouter } from "expo-router"
import { useCallback, useEffect, useState } from "react"
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import type { MobileFavorite, MobileListingCard, MobileOrder } from "@reswell/api-contract"
import { ListingCard } from "@/components/listing-card"
import { MeProfileHeader, type MeTab } from "@/components/me-profile-header"
import { OrderAccountCard } from "@/components/order-account-card"
import { ShopListingTile } from "@/components/shop-listing-tile"
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
  const [purchases, setPurchases] = useState<MobileOrder[] | null>(null)
  const [likes, setLikes] = useState<MobileFavorite[] | null>(null)
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
    if (!token) return
    if (next === "sold" && slug && !sold) {
      fetchProfileListings(slug, { status: "sold" })
        .then((page) => setSold(page.listings))
        .catch(() => setSold([]))
    }
    if (next === "purchases" && !purchases) {
      fetchPurchases(token)
        .then((page) => setPurchases(page.orders))
        .catch(() => setPurchases([]))
    }
    if (next === "likes" && !likes) {
      fetchFavorites(token)
        .then((page) => setLikes(page.favorites))
        .catch(() => setLikes([]))
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
  const listings = tab === "sold" ? (sold ?? []) : tab === "shop" ? shop : []
  const listingCount = dashboard?.active_listing_count ?? shop.length
  const hasShop = listingCount > 0 || (dashboard?.wallet_balance_usd ?? 0) > 0
  const likeCards = likes ?? []
  const purchaseCards = purchases ?? []
  const grid: Array<MobileListingCard | null> =
    tab === "likes"
      ? likeCards.length % 2 === 1
        ? [...likeCards.map((favorite) => favorite.listing), null]
        : likeCards.map((favorite) => favorite.listing)
      : tab === "purchases"
        ? []
        : listings.length % 2 === 1
          ? [...listings, null]
          : listings
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
      listingCount={listingCount}
      showEarnings={hasShop}
      tab={tab}
      onTab={showTab}
      onSell={() => router.push("/sell")}
      onMenu={() => router.push("/account/menu")}
      onFollowers={() => router.push("/account/followers")}
      onReviews={() => router.push("/account/reviews")}
      onFollowing={() => router.push("/account/following")}
      onEarnings={() => router.push("/account/earnings")}
      availableLabel={dashboard?.wallet_balance_label ?? "$0.00"}
    />
  )
  const empty = (
    <EmptyTab
      tab={tab}
      error={inventoryError}
      loading={tab === "shop" ? !shopLoaded : tab === "sold" ? sold === null : tab === "purchases" ? purchases === null : likes === null}
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
      ) : (
        <FlatList
          key={tab === "purchases" ? "purchases" : "grid"}
          data={tab === "purchases" ? purchaseCards : grid}
          keyExtractor={(item, index) => (item && "order_number" in item ? item.id : item?.id) ?? `spacer-${index}`}
          numColumns={tab === "purchases" ? 1 : 2}
          columnWrapperStyle={tab !== "purchases" && grid.length > 0 ? styles.row : undefined}
          contentContainerStyle={styles.list}
          ListHeaderComponent={header}
          ListEmptyComponent={empty}
          renderItem={({ item }) => {
            if (!item) return <View style={styles.spacer} />
            if ("order_number" in item) return <OrderAccountCard order={item} />
            if (tab === "likes") {
              return (
                <ListingCard
                  item={item}
                  initialFavorited
                  onPress={() => router.push({ pathname: "/listing/[id]", params: { id: item.slug || item.id } })}
                />
              )
            }
            return (
              <ShopListingTile
                item={item}
                status={tab === "sold" ? "Sold" : "Active"}
                onPress={() => router.push({ pathname: "/listing/[id]", params: { id: item.slug || item.id } })}
              />
            )
          }}
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
  if (tab === "purchases") {
    return <Text style={[styles.emptyBody, { color: colors.muted, fontFamily: fontFamily.text }]}>No purchases yet.</Text>
  }
  if (tab === "likes") {
    return <Text style={[styles.emptyBody, { color: colors.muted, fontFamily: fontFamily.text }]}>No liked listings yet.</Text>
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
  return <Text style={[styles.emptyBody, { color: colors.muted, fontFamily: fontFamily.text }]}>No sold listings yet.</Text>
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
