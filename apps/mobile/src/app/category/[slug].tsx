import { Stack, useLocalSearchParams } from "expo-router"
import { useCallback, useEffect, useMemo, useState, type SetStateAction } from "react"
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import type { MobileCategory, MobileCategorySortId, MobileListingCard, MobileListingsPage } from "@reswell/api-contract"
import { CategoryFilters } from "@/components/category-filters"
import { CategoryHero } from "@/components/category-hero"
import { type CategoryPlace, type CategoryRadius } from "@/components/category-location-filter"
import { CategoryLocationButton } from "@/components/category-location-sheet"
import { CategoryToolbar } from "@/components/category-toolbar"
import { useFloatingTabBarContentInset } from "@/components/floating-tab-bar"
import { ScreenSearchHeader } from "@/components/screen-search-header"
import {
  MarketplaceListingLayoutItem,
  marketplaceListingRows,
} from "@/components/marketplace-listing-layout-item"
import { type ListingLayout } from "@/components/listing-layout-switch"
import { marketplaceListContentStyle } from "@/components/listing-list-layout"
import { bottomSheetListPaddingBottom } from "@/components/screen-shell"
import { fetchCategory, fetchCategoryListings } from "@/lib/api"
import { useListingSellerFollow } from "@/lib/listing-seller-follow"
import { peekCategory, peekCategoryListings } from "@/lib/marketplace-screen-cache"
import { categoryListingQuery, type SelectedFacets } from "@/lib/category-listing-query"
import { fontFamily, useReswellColors } from "@/theme"

export default function CategoryScreen() {
  const colors = useReswellColors()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ slug: string; type?: string }>()
  const slug = params.slug
  const boardType = params.type
  const initialListingsQuery = categoryListingQuery(0, "relevant", false, {}, boardType, null, "any")
  const cachedCategory = slug ? peekCategory(slug) : null
  const cachedPage = slug ? peekCategoryListings(slug, initialListingsQuery) : null
  const [category, setCategory] = useState<MobileCategory | null>(cachedCategory)
  const [page, setPage] = useState<MobileListingsPage | null>(cachedPage)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(!cachedCategory)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [sort, setSort] = useState<MobileCategorySortId>("relevant")
  const [shipping, setShipping] = useState(false)
  const [selected, setSelected] = useState<SelectedFacets>({})
  const [place, setPlace] = useState<CategoryPlace | null>(null)
  const [radius, setRadius] = useState<CategoryRadius>("any")
  const [layout, setLayout] = useState<ListingLayout>("grid")
  const [sortOpen, setSortOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const load = useCallback((mode: "silent" | "pull" = "silent") => {
    if (!slug) return
    let cancelled = false
    const query = categoryListingQuery(0, sort, shipping, selected, boardType, place, radius)
    const cachedNextCategory = peekCategory(slug)
    const cachedNextPage = peekCategoryListings(slug, query)
    if (cachedNextCategory) setCategory(cachedNextCategory)
    if (cachedNextPage) setPage(cachedNextPage)
    if (mode === "pull") setRefreshing(true)
    else if (!cachedNextCategory) setLoading(true)
    else if (!cachedNextPage) setRefreshing(true)
    Promise.all([
      fetchCategory(slug, { force: mode === "pull" }),
      fetchCategoryListings(slug, query, { force: mode === "pull" }),
    ])
      .then(([nextCategory, nextPage]) => {
        if (!cancelled) {
          setCategory(nextCategory)
          setPage(nextPage)
          setError(null)
        }
      })
      .catch((cause: unknown) => {
        if (cancelled || peekCategory(slug)) return
        setError(cause instanceof Error ? cause.message : "Unable to load this category")
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
          setRefreshing(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [slug, sort, shipping, selected, boardType, place, radius])

  useEffect(() => {
    return load()
  }, [load])

  function loadMore() {
    if (!page?.has_more || loadingMore || loading || !slug) return
    setLoadingMore(true)
    fetchCategoryListings(slug, categoryListingQuery(page.offset + page.limit, sort, shipping, selected, boardType, place, radius))
      .then((next) => {
        setPage((current) =>
          current ? { ...next, listings: [...current.listings, ...next.listings] } : next,
        )
      })
      .catch(() => undefined)
      .finally(() => setLoadingMore(false))
  }

  const listings = page?.listings ?? []

  const setListings = useCallback((action: SetStateAction<MobileListingCard[]>) => {
    setPage((current) => {
      if (!current) return current
      const nextListings = typeof action === "function" ? action(current.listings) : action
      return { ...current, listings: nextListings }
    })
  }, [])

  const { viewerId, followBusyId, openListing, openSeller, toggleFollow } = useListingSellerFollow(setListings)
  const tabBarInset = useFloatingTabBarContentInset()
  const rows = useMemo(() => marketplaceListingRows(listings, layout), [layout, listings])
  const showLocation = slug === "surfboards"
  const filterCount =
    Object.values(selected).reduce((sum, values) => sum + values.length, 0) + (shipping ? 1 : 0)

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenSearchHeader showBack />
      {loading && !category ? (
        <ActivityIndicator style={styles.centered} color={colors.foreground} />
      ) : error && !category ? (
        <View style={styles.centered}>
          <Text style={{ color: colors.foreground, fontFamily: fontFamily.text }}>{error}</Text>
          <Pressable onPress={() => load()}>
            <Text style={[styles.retry, { color: colors.foreground, fontFamily: fontFamily.text }]}>Try again</Text>
          </Pressable>
        </View>
      ) : category ? (
        <FlatList
          data={rows}
          extraData={followBusyId}
          keyExtractor={(item) => item.key}
          contentContainerStyle={[marketplaceListContentStyle(styles.listBase), tabBarInset]}
          refreshing={refreshing}
          onRefresh={() => load("pull")}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListHeaderComponent={
            <View>
              <CategoryHero title={category.title} imageUrl={category.image_url} imagePosition={category.image_position} />
              <CategoryToolbar
                count={listings.length}
                filterCount={filterCount}
                layout={layout}
                onSort={() => setSortOpen(true)}
                onFilter={() => setFiltersOpen(true)}
                onLayout={setLayout}
                location={
                  showLocation ? (
                    <CategoryLocationButton
                      place={place}
                      radius={radius}
                      onPlaceChange={setPlace}
                      onRadiusChange={setRadius}
                    />
                  ) : null
                }
              />
            </View>
          }
          ListEmptyComponent={
            loading ? null : (
              <Text style={[styles.empty, { color: colors.muted, fontFamily: fontFamily.text }]}>
                No listings match these filters.
              </Text>
            )
          }
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color={colors.foreground} style={styles.footer} /> : null
          }
          renderItem={({ item }) => (
            <MarketplaceListingLayoutItem
              row={item}
              viewerId={viewerId}
              followBusyId={followBusyId}
              onPress={openListing}
              onPressSeller={openSeller}
              onFollowSeller={toggleFollow}
            />
          )}
        />
      ) : null}
      <Modal visible={sortOpen} transparent animationType="fade" onRequestClose={() => setSortOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setSortOpen(false)}>
          <View
            style={[
              styles.sheet,
              { backgroundColor: colors.background, paddingBottom: bottomSheetListPaddingBottom(insets.bottom) },
            ]}
          >
            {category?.sorts.map((item) => (
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
        showLocation={showLocation}
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

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  retry: { fontSize: 16, fontWeight: "600" },
  listBase: { paddingTop: 4 },
  empty: { textAlign: "center", marginTop: 32, fontSize: 16 },
  footer: { marginVertical: 16 },
  scrim: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.28)" },
  sheet: { borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingTop: 8 },
  sheetRow: { paddingHorizontal: 20, paddingVertical: 16 },
})
