import { Stack, useLocalSearchParams, useRouter } from "expo-router"
import { SymbolView } from "expo-symbols"
import { useEffect, useState } from "react"
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import {
  MOBILE_LISTING_CATEGORIES,
  type MobileCategory,
  type MobileCategorySortId,
  type MobileListingCard,
  type MobileListingCategory,
  type MobileListingsPage,
  type MobileSearchResults,
} from "@reswell/api-contract"
import { CategoryFilters } from "@/components/category-filters"
import { type CategoryPlace, type CategoryRadius } from "@/components/category-location-filter"
import { ListingCard } from "@/components/listing-card"
import { SaveSearchCard } from "@/components/save-search-card"
import { fetchCategory, fetchCategoryListings, fetchSavedSearch, fetchSearchResults } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { categoryListingQuery, type SelectedFacets } from "@/lib/category-listing-query"
import { fontFamily, useReswellColors } from "@/theme"

const SORTS: { id: MobileCategorySortId; label: string }[] = [
  { id: "relevant", label: "Most Relevant" },
  { id: "newest", label: "Newest" },
  { id: "price-low", label: "Price: Low to high" },
  { id: "price-high", label: "Price: High to low" },
]

export default function SearchResultsScreen() {
  const colors = useReswellColors()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { session } = useAuth()
  const params = useLocalSearchParams<{ q?: string }>()
  const query = typeof params.q === "string" ? params.q.trim() : ""
  const [draft, setDraft] = useState(query)
  const [browse, setBrowse] = useState<MobileSearchResults["browse"]>(null)
  const [searchListings, setSearchListings] = useState<MobileListingCard[]>([])
  const [facetSlug, setFacetSlug] = useState<MobileListingCategory>("surfboards")
  const [category, setCategory] = useState<MobileCategory | null>(null)
  const [page, setPage] = useState<MobileListingsPage | null>(null)
  const [savedSearchId, setSavedSearchId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<MobileCategorySortId>("relevant")
  const [shipping, setShipping] = useState(false)
  const [selected, setSelected] = useState<SelectedFacets>({})
  const [place, setPlace] = useState<CategoryPlace | null>(null)
  const [radius, setRadius] = useState<CategoryRadius>("any")
  const [sortOpen, setSortOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)

  useEffect(() => {
    setDraft(query)
  }, [query])

  useEffect(() => {
    if (query.length < 2) {
      setSearchListings([])
      setBrowse(null)
      setPage(null)
      setLoading(false)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setBrowse(null)
    setPage(null)
    setSort("relevant")
    setShipping(false)
    setSelected({})
    setPlace(null)
    setRadius("any")
    fetchSearchResults(query)
      .then((result) => {
        if (cancelled) return
        setBrowse(result.browse)
        setSearchListings(result.listings)
        setFacetSlug(result.browse?.category ?? inferCategory(result.listings))
        setError(null)
        if (!result.browse) setLoading(false)
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Unable to load search results")
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [query])

  useEffect(() => {
    let cancelled = false
    fetchCategory(facetSlug)
      .then((next) => {
        if (!cancelled) setCategory(next)
      })
      .catch(() => {
        if (!cancelled) setCategory(null)
      })
    return () => {
      cancelled = true
    }
  }, [facetSlug])

  useEffect(() => {
    if (!browse || query.length < 2) return
    let cancelled = false
    setLoading(true)
    fetchCategoryListings(
      browse.category,
      categoryListingQuery(0, sort, shipping, selected, browse.board_type ?? undefined, place, radius),
    )
      .then((next) => {
        if (!cancelled) setPage(next)
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load search results")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [browse, place, query.length, radius, selected, shipping, sort])

  useEffect(() => {
    const token = session?.access_token
    if (!token || query.length < 2) {
      setSavedSearchId(null)
      return
    }
    let cancelled = false
    fetchSavedSearch(token, query)
      .then((result) => {
        if (!cancelled) setSavedSearchId(result.saved_search_id)
      })
      .catch(() => {
        if (!cancelled) setSavedSearchId(null)
      })
    return () => {
      cancelled = true
    }
  }, [query, session?.access_token])

  function submitSearch() {
    const next = draft.trim()
    if (next.length < 2 || next === query) return
    router.setParams({ q: next })
  }

  function loadMore() {
    if (!browse || !page?.has_more || loadingMore || loading) return
    setLoadingMore(true)
    fetchCategoryListings(
      browse.category,
      categoryListingQuery(page.offset + page.limit, sort, shipping, selected, browse.board_type ?? undefined, place, radius),
    )
      .then((next) => {
        setPage((current) => (current ? { ...next, listings: [...current.listings, ...next.listings] } : next))
      })
      .catch(() => undefined)
      .finally(() => setLoadingMore(false))
  }

  const listings = browse
    ? (page?.listings ?? [])
    : filterSearchListings(searchListings, { sort, shipping, selected })
  const grid = listings.length % 2 === 1 ? [...listings, null] : listings
  const sorts = category?.sorts ?? SORTS
  const filterCount =
    Object.values(selected).reduce((sum, values) => sum + values.length, 0) + (shipping ? 1 : 0) + (place ? 1 : 0)

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { paddingTop: insets.top, borderBottomColor: colors.border }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} onPress={() => router.back()}>
          <SymbolView name={{ ios: "chevron.left", android: "arrow_back", web: "arrow_back" }} size={22} tintColor={colors.foreground} />
        </Pressable>
        <View style={[styles.field, { borderColor: colors.border }]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Search surfboards, fins, wetsuits or apparel…"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={submitSearch}
            style={[styles.input, { color: colors.foreground, fontFamily: fontFamily.text }]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Search"
            onPress={submitSearch}
            style={[styles.searchButton, { backgroundColor: colors.primary }]}
          >
            <SymbolView
              name={{ ios: "magnifyingglass", android: "search", web: "search" }}
              size={16}
              tintColor={colors.primaryForeground}
              weight="semibold"
            />
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cart"
          hitSlop={6}
          onPress={() => router.push(session ? "/account/cart" : "/sign-in")}
        >
          <SymbolView name={{ ios: "cart", android: "shopping_cart", web: "shopping_cart" }} size={22} tintColor={colors.foreground} />
        </Pressable>
      </View>
      {loading && listings.length === 0 ? (
        <ActivityIndicator style={styles.centered} color={colors.foreground} />
      ) : error && listings.length === 0 ? (
        <View style={styles.centered}>
          <Text style={{ color: colors.foreground, fontFamily: fontFamily.text }}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={grid}
          keyExtractor={(item) => item?.id ?? "spacer"}
          numColumns={2}
          columnWrapperStyle={listings.length > 0 ? styles.columns : undefined}
          contentContainerStyle={styles.list}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListHeaderComponent={
            <View style={styles.toolsBlock}>
              <View style={styles.tools}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Filter"
                  onPress={() => setFiltersOpen(true)}
                  style={[styles.tool, { backgroundColor: colors.image }]}
                >
                  <SymbolView
                    name={{ ios: "slider.horizontal.3", android: "tune", web: "tune" }}
                    size={20}
                    tintColor={colors.foreground}
                  />
                  {filterCount > 0 ? (
                    <View style={[styles.badge, { backgroundColor: colors.foreground }]}>
                      <Text style={[styles.badgeLabel, { color: colors.primaryForeground }]}>{filterCount}</Text>
                    </View>
                  ) : null}
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Sort by"
                  onPress={() => setSortOpen(true)}
                  style={[styles.sort, { backgroundColor: colors.image }]}
                >
                  <Text style={[styles.sortLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>Sort by</Text>
                  <SymbolView
                    name={{ ios: "chevron.down", android: "expand_more", web: "expand_more" }}
                    size={16}
                    tintColor={colors.foreground}
                  />
                </Pressable>
              </View>
              <Text style={[styles.count, { color: colors.muted, fontFamily: fontFamily.text }]}>
                {listings.length} {listings.length === 1 ? "result" : "results"}
              </Text>
            </View>
          }
          ListEmptyComponent={
            loading ? null : (
              <Text style={[styles.empty, { color: colors.muted, fontFamily: fontFamily.text }]}>
                No listings match that search.
              </Text>
            )
          }
          ListFooterComponent={
            query.length >= 2 ? (
              <View>
                {loadingMore ? <ActivityIndicator color={colors.foreground} style={styles.footer} /> : null}
                <SaveSearchCard
                  query={query}
                  accessToken={session?.access_token ?? null}
                  savedSearchId={savedSearchId}
                  onSignIn={() => router.push("/sign-in")}
                  onChange={setSavedSearchId}
                />
              </View>
            ) : null
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
      )}
      <Modal visible={sortOpen} transparent animationType="fade" onRequestClose={() => setSortOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setSortOpen(false)}>
          <View style={[styles.sheet, { backgroundColor: colors.background }]}>
            {sorts.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => {
                  setSort(item.id)
                  setSortOpen(false)
                }}
                style={styles.sheetRow}
              >
                <Text
                  style={{
                    color: item.id === sort ? colors.foreground : colors.muted,
                    fontFamily: fontFamily.text,
                    fontWeight: "600",
                    fontSize: 16,
                  }}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
      <CategoryFilters
        visible={filtersOpen}
        facets={category?.facets ?? []}
        ship={category?.ship ?? false}
        showLocation={facetSlug === "surfboards"}
        shipping={shipping}
        selected={selected}
        place={place}
        radius={radius}
        onShippingChange={setShipping}
        onSelectedChange={setSelected}
        onPlaceChange={setPlace}
        onRadiusChange={setRadius}
        onClear={() => {
          setSelected({})
          setShipping(false)
          setPlace(null)
          setRadius("any")
        }}
        onClose={() => setFiltersOpen(false)}
      />
    </View>
  )
}

function inferCategory(listings: MobileListingCard[]): MobileListingCategory {
  const sections = [...new Set(listings.map((item) => item.section))].filter((section): section is MobileListingCategory =>
    (MOBILE_LISTING_CATEGORIES as readonly string[]).includes(section),
  )
  if (sections.length === 1) return sections[0]
  if (sections.includes("surfboards")) return "surfboards"
  return sections[0] ?? "surfboards"
}

function filterSearchListings(
  listings: MobileListingCard[],
  input: { sort: MobileCategorySortId; shipping: boolean; selected: SelectedFacets },
): MobileListingCard[] {
  const conditions = input.selected.condition ?? []
  const styles = input.selected.style ?? []
  let next = listings.filter((listing) => {
    if (input.shipping && !listing.shipping_available) return false
    if (conditions.length > 0 && !conditions.includes(listing.condition ?? "")) return false
    if (styles.length > 0 && !styles.includes(listing.board_type ?? "")) return false
    return true
  })
  if (input.sort === "price-low") next = [...next].sort((a, b) => a.price_usd - b.price_usd)
  if (input.sort === "price-high") next = [...next].sort((a, b) => b.price_usd - a.price_usd)
  return next
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  field: {
    flex: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 999,
    paddingLeft: 14,
    paddingRight: 4,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: 8 },
  searchButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  list: { paddingTop: 8, paddingBottom: 120, paddingHorizontal: 12 },
  columns: { gap: 12 },
  toolsBlock: { paddingBottom: 12, gap: 12 },
  tools: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 4 },
  tool: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  sort: {
    minHeight: 44,
    borderRadius: 22,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sortLabel: { fontSize: 15, fontWeight: "700" },
  badge: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeLabel: { fontSize: 10, fontWeight: "700" },
  count: { paddingHorizontal: 4, fontSize: 14 },
  empty: { textAlign: "center", marginTop: 32, fontSize: 16 },
  footer: { marginVertical: 16 },
  spacer: { flex: 1 },
  scrim: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.28)" },
  sheet: { borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingVertical: 8 },
  sheetRow: { paddingHorizontal: 20, paddingVertical: 16 },
})
