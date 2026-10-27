import { Stack, useLocalSearchParams } from "expo-router"
import { useCallback, useEffect, useRef, useState } from "react"
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native"
import type { MobileListingCard, MobileMarketplaceFeed, MobileMarketplaceFeedTab } from "@reswell/api-contract"
import { MarketplaceListingLayoutItem } from "@/components/marketplace-listing-layout-item"
import { ListingLayoutSwitch, type ListingLayout } from "@/components/listing-layout-switch"
import { useFloatingTabBarContentInset } from "@/components/floating-tab-bar"
import { marketplaceListContentStyle } from "@/components/listing-list-layout"
import { ScreenSearchHeader } from "@/components/screen-search-header"
import { fetchMarketplaceFeed } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useAuthGate } from "@/lib/auth-gate"
import { useListingSellerFollow } from "@/lib/listing-seller-follow"
import { fontFamily, useReswellColors } from "@/theme"

const FEED_SCREEN_TITLE = "New Listings Feed"

const FEEDS: { tab: MobileMarketplaceFeedTab; label: string; subtitle: string }[] = [
  {
    tab: "new",
    label: "New Listings",
    subtitle: "Every active surfboard listing on Reswell, ordered newest to oldest.",
  },
  {
    tab: "sold",
    label: "Sold",
    subtitle: "Surfboards and fins that found new homes on Reswell.",
  },
  {
    tab: "shipped",
    label: "Shipped Boards",
    subtitle: "Sold surfboards where the buyer chose shipping at checkout.",
  },
]

const EMPTY_COPY: Record<MobileMarketplaceFeedTab, { title: string; body: string }> = {
  new: {
    title: "No listings yet",
    body: "New surfboards will show up here as sellers list them.",
  },
  sold: {
    title: "No sales yet",
    body: "Surfboards and fins that sell on Reswell will show up here.",
  },
  shipped: {
    title: "No shipped boards yet",
    body: "When a buyer chooses shipping at checkout, the board will show up here.",
  },
}

function badgeFor(tab: MobileMarketplaceFeedTab): string | undefined {
  if (tab === "sold") return "Sold"
  if (tab === "shipped") return "Shipped"
  return undefined
}

function requestedFeedTab(value: string | string[] | undefined): MobileMarketplaceFeedTab | null {
  const tab = Array.isArray(value) ? value[0] : value
  if (tab === "sold" || tab === "shipped" || tab === "new") return tab
  return null
}

export default function FeedScreen() {
  const colors = useReswellColors()
  const { session, signOut } = useAuth()
  const { requestAuth } = useAuthGate()
  const token = session?.access_token
  const params = useLocalSearchParams<{ tab?: string }>()
  const [tab, setTab] = useState<MobileMarketplaceFeedTab>(requestedFeedTab(params.tab) ?? "new")
  const [feed, setFeed] = useState<MobileMarketplaceFeed | null>(null)
  const [listings, setListings] = useState<MobileListingCard[]>([])
  const [error, setError] = useState<string | null>(null)
  const [needsSignIn, setNeedsSignIn] = useState(false)
  const [promptSignIn, setPromptSignIn] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [layout, setLayout] = useState<ListingLayout>("grid")
  const { viewerId, followBusyId, openListing, openSeller, toggleFollow } = useListingSellerFollow(setListings)
  const tabBarInset = useFloatingTabBarContentInset()
  const requestId = useRef(0)
  const loadingMoreRef = useRef(false)
  const tabRef = useRef(tab)
  tabRef.current = tab

  const load = useCallback(
    (nextTab: MobileMarketplaceFeedTab) => {
    const id = ++requestId.current
    setLoading(true)
    fetchMarketplaceFeed({ tab: nextTab }, token)
      .then((next) => {
        if (requestId.current !== id) return
        setFeed(next)
        setListings(next.listings)
        setError(null)
        setNeedsSignIn(false)
      })
      .catch((cause: unknown) => {
        if (requestId.current !== id) return
        const message = cause instanceof Error ? cause.message : "Unable to load the feed"
        if (message === "Sign in required") {
          setError(null)
          setNeedsSignIn(true)
          setPromptSignIn(true)
          if (token) void signOut()
          return
        }
        setNeedsSignIn(false)
        setFeed(null)
        setListings([])
        setError(message)
      })
      .finally(() => {
        if (requestId.current === id) setLoading(false)
      })
  },
    [signOut, token],
  )

  useEffect(() => {
    const requested = requestedFeedTab(params.tab)
    if (requested && requested !== tabRef.current) setTab(requested)
  }, [params.tab])

  useEffect(() => {
    load(tab)
  }, [load, tab])

  useEffect(() => {
    if (!promptSignIn || session?.access_token) return
    setPromptSignIn(false)
    requestAuth()
  }, [promptSignIn, requestAuth, session?.access_token])

  function chooseFeed(next: MobileMarketplaceFeedTab) {
    if (next === tab) return
    setFeed(null)
    setListings([])
    setTab(next)
  }

  function loadMore() {
    if (!feed?.has_more || loadingMoreRef.current || loading) return
    const currentTab = tabRef.current
    const cursor = currentTab === "sold" ? feed.next_cursor : null
    if (currentTab === "sold" && !cursor) return
    const id = requestId.current
    loadingMoreRef.current = true
    setLoadingMore(true)
    const request = cursor
      ? fetchMarketplaceFeed({ tab: "sold", sold_at: cursor.sold_at, listing_id: cursor.listing_id }, token)
      : fetchMarketplaceFeed({ tab: currentTab, page: feed.page + 1 }, token)
    request
      .then((next) => {
        if (requestId.current !== id || tabRef.current !== currentTab) return
        setListings((current) => {
          const seen = new Set(current.map((listing) => listing.id))
          return [...current, ...next.listings.filter((listing) => !seen.has(listing.id))]
        })
        setFeed((current) =>
          current
            ? { ...current, page: next.page, has_more: next.has_more, next_cursor: next.next_cursor }
            : next,
        )
      })
      .catch(() => undefined)
      .finally(() => {
        loadingMoreRef.current = false
        setLoadingMore(false)
      })
  }

  const grid = layout === "grid" && listings.length % 2 === 1 ? [...listings, null] : listings
  const empty = EMPTY_COPY[tab]
  const badge = badgeFor(tab)

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenSearchHeader insetTop bordered={false} />
      <View style={[styles.header, { paddingTop: 8 }]}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
            {FEED_SCREEN_TITLE}
          </Text>
          <ListingLayoutSwitch layout={layout} onLayout={setLayout} />
        </View>
        <FeedTabBar tab={tab} onTab={chooseFeed} />
      </View>
      {(loading || (needsSignIn && Boolean(session?.access_token))) && listings.length === 0 ? (
        <ActivityIndicator style={styles.centered} color={colors.foreground} />
      ) : needsSignIn && listings.length === 0 ? (
        <View style={styles.centered}>
          <Pressable onPress={() => requestAuth()} style={[styles.signIn, { backgroundColor: colors.primary }]}>
            <Text style={[styles.signInLabel, { color: colors.primaryForeground, fontFamily: fontFamily.text }]}>
              Sign in
            </Text>
          </Pressable>
        </View>
      ) : error && listings.length === 0 ? (
        <View style={styles.centered}>
          <Text style={{ color: colors.foreground, fontFamily: fontFamily.text }}>{error}</Text>
          <Pressable onPress={() => load(tab)}>
            <Text style={[styles.retry, { color: colors.foreground, fontFamily: fontFamily.text }]}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          key={layout}
          data={grid}
          keyExtractor={(item) => item?.id ?? "spacer"}
          numColumns={layout === "grid" ? 2 : 1}
          columnWrapperStyle={layout === "grid" ? styles.columns : undefined}
          contentContainerStyle={[marketplaceListContentStyle(styles.list, layout), tabBarInset]}
          refreshing={loading}
          onRefresh={() => load(tab)}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            loading ? null : (
              <View style={styles.empty}>
                <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
                  {empty.title}
                </Text>
                <Text style={[styles.emptyBody, { color: colors.muted, fontFamily: fontFamily.text }]}>{empty.body}</Text>
              </View>
            )
          }
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color={colors.foreground} style={styles.footer} /> : null
          }
          renderItem={({ item }) =>
            item ? (
              <MarketplaceListingLayoutItem
                layout={layout}
                item={item}
                badge={badge}
                viewerId={viewerId}
                followBusy={followBusyId === item.seller?.id}
                onPress={() => openListing(item)}
                onPressSeller={openSeller}
                onFollowSeller={toggleFollow}
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

function FeedTabBar({
  tab,
  onTab,
}: {
  tab: MobileMarketplaceFeedTab
  onTab: (next: MobileMarketplaceFeedTab) => void
}) {
  const colors = useReswellColors()
  return (
    <View style={[styles.tabBar, { backgroundColor: colors.image }]}>
      {FEEDS.map((item) => {
        const active = item.tab === tab
        return (
          <Pressable
            key={item.tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onTab(item.tab)}
            style={[styles.tabItem, active ? { backgroundColor: colors.background } : null]}
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
              style={[
                styles.tabLabel,
                {
                  color: active ? colors.foreground : colors.muted,
                  fontFamily: fontFamily.text,
                  fontWeight: active ? "700" : "600",
                },
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 10, gap: 12 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  title: { flex: 1, fontSize: 22, fontWeight: "700", letterSpacing: -0.3 },
  tabBar: { flexDirection: "row", borderRadius: 12, padding: 4, gap: 4 },
  tabItem: {
    flex: 1,
    minHeight: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  tabLabel: { fontSize: 13, textAlign: "center" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  retry: { fontSize: 16, fontWeight: "600" },
  signIn: { minHeight: 44, borderRadius: 22, paddingHorizontal: 22, alignItems: "center", justifyContent: "center" },
  signInLabel: { fontSize: 16, fontWeight: "700" },
  list: { paddingTop: 8 },
  columns: { gap: 12, paddingHorizontal: 12 },
  empty: { alignItems: "center", paddingHorizontal: 28, paddingTop: 48, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptyBody: { textAlign: "center", fontSize: 15, lineHeight: 21 },
  footer: { marginVertical: 16 },
  spacer: { flex: 1 },
})
