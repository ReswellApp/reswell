import { Stack, useLocalSearchParams, useRouter } from "expo-router"
import { SymbolView } from "expo-symbols"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native"
import type { MobileListingCard, MobileMarketplaceFeed, MobileMarketplaceFeedTab } from "@reswell/api-contract"
import { ScreenSearchHeader } from "@/components/screen-search-header"
import { ListingCard } from "@/components/listing-card"
import { ListingLayoutSwitch, type ListingLayout } from "@/components/listing-layout-switch"
import { fetchMarketplaceFeed } from "@/lib/api"
import { fontFamily, useReswellColors } from "@/theme"

const FEEDS: { tab: MobileMarketplaceFeedTab; label: string; subtitle: string }[] = [
  {
    tab: "new",
    label: "New listings",
    subtitle: "Every active surfboard listing on Reswell, ordered newest to oldest.",
  },
  {
    tab: "sold",
    label: "Sold",
    subtitle: "Surfboards and fins that found new homes on Reswell.",
  },
  {
    tab: "shipped",
    label: "Shipped boards",
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
  const router = useRouter()
  const params = useLocalSearchParams<{ tab?: string }>()
  const [tab, setTab] = useState<MobileMarketplaceFeedTab>(requestedFeedTab(params.tab) ?? "new")
  const [feed, setFeed] = useState<MobileMarketplaceFeed | null>(null)
  const [listings, setListings] = useState<MobileListingCard[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [layout, setLayout] = useState<ListingLayout>("grid")
  const requestId = useRef(0)
  const loadingMoreRef = useRef(false)
  const tabRef = useRef(tab)
  tabRef.current = tab

  const load = useCallback((nextTab: MobileMarketplaceFeedTab) => {
    const id = ++requestId.current
    setLoading(true)
    fetchMarketplaceFeed({ tab: nextTab })
      .then((next) => {
        if (requestId.current !== id) return
        setFeed(next)
        setListings(next.listings)
        setError(null)
      })
      .catch((cause: unknown) => {
        if (requestId.current !== id) return
        setFeed(null)
        setListings([])
        setError(cause instanceof Error ? cause.message : "Unable to load the feed")
      })
      .finally(() => {
        if (requestId.current === id) setLoading(false)
      })
  }, [])

  useEffect(() => {
    const requested = requestedFeedTab(params.tab)
    if (requested && requested !== tabRef.current) setTab(requested)
  }, [params.tab])

  useEffect(() => {
    load(tab)
  }, [load, tab])

  function chooseFeed(next: MobileMarketplaceFeedTab) {
    setFilterOpen(false)
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
      ? fetchMarketplaceFeed({ tab: "sold", sold_at: cursor.sold_at, listing_id: cursor.listing_id })
      : fetchMarketplaceFeed({ tab: currentTab, page: feed.page + 1 })
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

  function openListing(listing: MobileListingCard) {
    router.push({ pathname: "/listing/[id]", params: { id: listing.slug || listing.id } })
  }

  const grid = layout === "grid" && listings.length % 2 === 1 ? [...listings, null] : listings
  const empty = EMPTY_COPY[tab]
  const selected = FEEDS.find((item) => item.tab === tab)
  const title = feed?.title ?? selected?.label ?? "Feed"
  const subtitle = feed?.subtitle ?? selected?.subtitle
  const badge = badgeFor(tab)

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenSearchHeader insetTop bordered={false} />
      <View style={[styles.header, { paddingTop: 8 }]}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.foreground, fontFamily: fontFamily.headline }]}>{title}</Text>
          <View style={styles.headerActions}>
            <ListingLayoutSwitch layout={layout} onLayout={setLayout} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose a feed"
              onPress={() => setFilterOpen(true)}
              hitSlop={8}
              style={[styles.filter, { backgroundColor: colors.image }]}
            >
              <SymbolView
                name={{ ios: "slider.horizontal.3", android: "tune", web: "tune" }}
                size={20}
                tintColor={colors.foreground}
              />
              {tab !== "new" ? <View style={[styles.dot, { backgroundColor: colors.foreground }]} /> : null}
            </Pressable>
          </View>
        </View>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.muted, fontFamily: fontFamily.text }]}>{subtitle}</Text>
        ) : null}
      </View>
      {loading && listings.length === 0 ? (
        <ActivityIndicator style={styles.centered} color={colors.foreground} />
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
          contentContainerStyle={layout === "grid" ? styles.list : [styles.list, styles.listSingle]}
          refreshing={loading}
          onRefresh={() => load(tab)}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListHeaderComponent={
            feed?.stats ? (
              <View style={[styles.stats, { backgroundColor: colors.image }]}>
                <Text style={[styles.statsText, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                  {feed.stats.caption}
                </Text>
              </View>
            ) : null
          }
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
              <ListingCard item={item} badge={badge} onPress={() => openListing(item)} />
            ) : (
              <View style={styles.spacer} />
            )
          }
        />
      )}
      <Modal visible={filterOpen} transparent animationType="fade" onRequestClose={() => setFilterOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setFilterOpen(false)}>
          <View style={[styles.sheet, { backgroundColor: colors.background }]}>
            <Text style={[styles.sheetTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>Feed</Text>
            {FEEDS.map((item) => {
              const selected = item.tab === tab
              return (
                <Pressable key={item.tab} onPress={() => chooseFeed(item.tab)} style={styles.sheetRow}>
                  <Text
                    style={{
                      color: selected ? colors.foreground : colors.muted,
                      fontFamily: fontFamily.text,
                      fontWeight: "600",
                      fontSize: 16,
                    }}
                  >
                    {item.label}
                  </Text>
                  {selected ? (
                    <SymbolView
                      name={{ ios: "checkmark", android: "check", web: "check" }}
                      size={18}
                      tintColor={colors.foreground}
                    />
                  ) : null}
                </Pressable>
              )
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 8, gap: 6 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { flex: 1, fontSize: 28, fontWeight: "700" },
  subtitle: { fontSize: 15, lineHeight: 21 },
  filter: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  dot: { position: "absolute", top: 8, right: 8, width: 7, height: 7, borderRadius: 4 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  retry: { fontSize: 16, fontWeight: "600" },
  list: { paddingTop: 8, paddingBottom: 120 },
  listSingle: { paddingHorizontal: 12 },
  columns: { gap: 12, paddingHorizontal: 12 },
  stats: { marginHorizontal: 16, marginBottom: 14, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  statsText: { textAlign: "center", fontSize: 14, fontWeight: "600" },
  empty: { alignItems: "center", paddingHorizontal: 28, paddingTop: 48, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptyBody: { textAlign: "center", fontSize: 15, lineHeight: 21 },
  footer: { marginVertical: 16 },
  spacer: { flex: 1 },
  scrim: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: { borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingTop: 16, paddingBottom: 28, paddingHorizontal: 8 },
  sheetTitle: { fontSize: 18, fontWeight: "700", paddingHorizontal: 16, paddingBottom: 8 },
  sheetRow: {
    minHeight: 52,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
})
