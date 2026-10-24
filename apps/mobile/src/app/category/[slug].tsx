import { Stack, useLocalSearchParams } from "expo-router"
import { useCallback, useEffect, useState, type SetStateAction } from "react"
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native"
import type { MobileCategory, MobileCategorySortId, MobileListingCard, MobileListingsPage } from "@reswell/api-contract"
import { CategoryFilters } from "@/components/category-filters"
import { CategoryHero } from "@/components/category-hero"
import { type CategoryPlace, type CategoryRadius } from "@/components/category-location-filter"
import { CategoryToolbar } from "@/components/category-toolbar"
import { ScreenSearchHeader } from "@/components/screen-search-header"
import { MarketplaceListingLayoutItem } from "@/components/marketplace-listing-layout-item"
import { type ListingLayout } from "@/components/listing-layout-switch"
import { marketplaceListContentStyle } from "@/components/listing-list-layout"
import { fetchCategory, fetchCategoryListings } from "@/lib/api"
import { useListingSellerFollow } from "@/lib/listing-seller-follow"
import { categoryListingQuery, type SelectedFacets } from "@/lib/category-listing-query"
import { fontFamily, useReswellColors } from "@/theme"

export default function CategoryScreen() {
  const colors = useReswellColors()
  const params = useLocalSearchParams<{ slug: string; type?: string }>()
  const slug = params.slug
  const boardType = params.type
  const [category, setCategory] = useState<MobileCategory | null>(null)
  const [page, setPage] = useState<MobileListingsPage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [sort, setSort] = useState<MobileCategorySortId>("relevant")
  const [shipping, setShipping] = useState(false)
  const [selected, setSelected] = useState<SelectedFacets>({})
  const [place, setPlace] = useState<CategoryPlace | null>(null)
  const [radius, setRadius] = useState<CategoryRadius>("any")
  const [layout, setLayout] = useState<ListingLayout>("grid")
  const [sortOpen, setSortOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const load = useCallback(() => {
    if (!slug) return
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetchCategory(slug),
      fetchCategoryListings(slug, categoryListingQuery(0, sort, shipping, selected, boardType, place, radius)),
    ])
      .then(([nextCategory, nextPage]) => {
        if (!cancelled) {
          setCategory(nextCategory)
          setPage(nextPage)
          setError(null)
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load this category")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
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
  const grid = layout === "grid" && listings.length % 2 === 1 ? [...listings, null] : listings
  const filterCount =
    Object.values(selected).reduce((sum, values) => sum + values.length, 0) + (shipping ? 1 : 0) + (place ? 1 : 0)

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenSearchHeader showBack />
      {loading && !category ? (
        <ActivityIndicator style={styles.centered} color={colors.foreground} />
      ) : error && !category ? (
        <View style={styles.centered}>
          <Text style={{ color: colors.foreground, fontFamily: fontFamily.text }}>{error}</Text>
          <Pressable onPress={load}>
            <Text style={[styles.retry, { color: colors.foreground, fontFamily: fontFamily.text }]}>Try again</Text>
          </Pressable>
        </View>
      ) : category ? (
        <FlatList
          key={layout}
          data={grid}
          keyExtractor={(item) => item?.id ?? "spacer"}
          numColumns={layout === "grid" ? 2 : 1}
          columnWrapperStyle={layout === "grid" ? styles.columns : undefined}
          contentContainerStyle={
            layout === "list" ? marketplaceListContentStyle(styles.listBase, layout) : styles.list
          }
          refreshing={loading}
          onRefresh={load}
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
          renderItem={({ item }) =>
            item ? (
              <MarketplaceListingLayoutItem
                layout={layout}
                item={item}
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
      ) : null}
      <Modal visible={sortOpen} transparent animationType="fade" onRequestClose={() => setSortOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setSortOpen(false)}>
          <View style={[styles.sheet, { backgroundColor: colors.background }]}>
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
        showLocation={slug === "surfboards"}
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
  list: { paddingTop: 4, paddingBottom: 120, paddingHorizontal: 12 },
  listBase: { paddingTop: 4, paddingBottom: 120 },
  columns: { gap: 12 },
  empty: { textAlign: "center", marginTop: 32, fontSize: 16 },
  footer: { marginVertical: 16 },
  spacer: { flex: 1 },
  scrim: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.28)" },
  sheet: { borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingVertical: 8 },
  sheetRow: { paddingHorizontal: 20, paddingVertical: 16 },
})
