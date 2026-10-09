import { Stack, useLocalSearchParams, useRouter } from "expo-router"
import { useCallback, useEffect, useState } from "react"
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native"
import type { MobileBoardType, MobileCategory, MobileCategoryListingsQuery, MobileCategorySortId, MobileListingCard, MobileListingsPage } from "@reswell/api-contract"
import { BoardStyleFilter } from "@/components/browse-chips"
import { CategoryHero } from "@/components/category-hero"
import { CategoryToolbar } from "@/components/category-toolbar"
import { ListingCard } from "@/components/listing-card"
import { fetchCategory, fetchCategoryListings } from "@/lib/api"
import { fontFamily, useReswellColors } from "@/theme"

type SelectedFacets = Record<string, string[]>

export default function CategoryScreen() {
  const colors = useReswellColors()
  const router = useRouter()
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
  const [layout, setLayout] = useState<"grid" | "list">("grid")
  const [sortOpen, setSortOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const load = useCallback(() => {
    if (!slug) return
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetchCategory(slug),
      fetchCategoryListings(slug, listingQuery(0, sort, shipping, selected, boardType)),
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
  }, [slug, sort, shipping, selected, boardType])

  useEffect(() => {
    return load()
  }, [load])

  function loadMore() {
    if (!page?.has_more || loadingMore || loading || !slug) return
    setLoadingMore(true)
    fetchCategoryListings(slug, listingQuery(page.offset + page.limit, sort, shipping, selected, boardType))
      .then((next) => {
        setPage((current) =>
          current ? { ...next, listings: [...current.listings, ...next.listings] } : next,
        )
      })
      .catch(() => undefined)
      .finally(() => setLoadingMore(false))
  }

  function openListing(listing: MobileListingCard) {
    router.push({ pathname: "/listing/[id]", params: { id: listing.slug || listing.id } })
  }

  const listings = page?.listings ?? []
  const grid = layout === "grid" && listings.length % 2 === 1 ? [...listings, null] : listings
  const sortLabel = category?.sorts.find((item) => item.id === sort)?.label ?? "Most Relevant"
  const filterCount = Object.values(selected).reduce((sum, values) => sum + values.length, 0) + (shipping ? 1 : 0)

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: "" }} />
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
          contentContainerStyle={styles.list}
          refreshing={loading}
          onRefresh={load}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListHeaderComponent={
            <View>
              <CategoryHero title={category.title} imageUrl={category.image_url} imagePosition={category.image_position} />
              {slug === "surfboards" ? (
                <BoardStyleFilter
                  selected={isBoardType(boardType) ? boardType : null}
                  onSelect={(next) => router.setParams({ type: next ?? "" })}
                />
              ) : null}
              <CategoryToolbar
                sortLabel={sortLabel}
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
              <ListingCard item={item} onPress={() => openListing(item)} />
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
      <Modal visible={filtersOpen} animationType="slide" onRequestClose={() => setFiltersOpen(false)}>
        <View style={[styles.filterScreen, { backgroundColor: colors.background }]}>
          <View style={styles.filterHeader}>
            <Text style={[styles.filterTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>Filters</Text>
            <Pressable onPress={() => setFiltersOpen(false)}>
              <Text style={{ color: colors.foreground, fontFamily: fontFamily.text, fontWeight: "700" }}>Done</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.filterBody}>
            {category?.ship ? (
              <Pressable
                onPress={() => setShipping((current) => !current)}
                style={[styles.ship, { backgroundColor: shipping ? colors.foreground : colors.image }]}
              >
                <Text style={{ color: shipping ? colors.primaryForeground : colors.foreground, fontFamily: fontFamily.text, fontWeight: "700" }}>
                  Ship to me
                </Text>
              </Pressable>
            ) : null}
            {category?.facets.map((group) => (
              <View key={group.id} style={styles.group}>
                <Text style={[styles.groupTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>{group.label}</Text>
                <View style={styles.options}>
                  {group.options.map((option) => {
                    const active = selected[group.id]?.includes(option.value) ?? false
                    return (
                      <Pressable
                        key={option.value}
                        onPress={() =>
                          setSelected((current) => {
                            const values = current[group.id] ?? []
                            const next = values.includes(option.value)
                              ? values.filter((value) => value !== option.value)
                              : [...values, option.value]
                            return { ...current, [group.id]: next }
                          })
                        }
                        style={[
                          styles.option,
                          {
                            backgroundColor: active ? colors.foreground : colors.background,
                            borderColor: active ? colors.foreground : colors.border,
                          },
                        ]}
                      >
                        <Text style={{ color: active ? colors.primaryForeground : colors.foreground, fontFamily: fontFamily.text, fontSize: 14 }}>
                          {option.label}
                        </Text>
                      </Pressable>
                    )
                  })}
                </View>
              </View>
            ))}
            <Pressable
              onPress={() => {
                setSelected({})
                setShipping(false)
              }}
            >
              <Text style={{ color: colors.muted, fontFamily: fontFamily.text, fontWeight: "600" }}>Clear filters</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </View>
  )
}

function listingQuery(
  offset: number,
  sort: MobileCategorySortId,
  shipping: boolean,
  selected: SelectedFacets,
  boardType: string | undefined,
): Partial<MobileCategoryListingsQuery> & { offset: number } {
  const query: Partial<MobileCategoryListingsQuery> & { offset: number } = { offset, sort }
  if (shipping) query.shipping = "1"
  if (isBoardType(boardType)) query.type = boardType
  for (const [key, values] of Object.entries(selected)) {
    if (values.length === 0) continue
    const joined = values.join(",")
    if (key === "style") query.style = joined
    else if (key === "condition") query.condition = joined
    else if (key === "fin") query.fin = joined
    else if (key === "finSystem") query.finSystem = joined
    else if (key === "construction") query.construction = joined
    else if (key === "length") query.length = joined
    else if (key === "volume") query.volume = joined
    else if (key === "size") query.size = joined
    else if (key === "kind") query.kind = joined
  }
  return query
}

function isBoardType(value: string | undefined): value is MobileBoardType {
  return (
    value === "shortboard" ||
    value === "groveler" ||
    value === "fish" ||
    value === "asym" ||
    value === "hybrid" ||
    value === "longboard" ||
    value === "step-up-gun" ||
    value === "other"
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  retry: { fontSize: 16, fontWeight: "600" },
  list: { paddingTop: 4, paddingBottom: 120, paddingHorizontal: 12 },
  columns: { gap: 12 },
  empty: { textAlign: "center", marginTop: 32, fontSize: 16 },
  footer: { marginVertical: 16 },
  spacer: { flex: 1 },
  scrim: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.28)" },
  sheet: { borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingVertical: 8 },
  sheetRow: { paddingHorizontal: 20, paddingVertical: 16 },
  filterScreen: { flex: 1, paddingTop: 56 },
  filterHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16 },
  filterTitle: { fontSize: 28, fontWeight: "700" },
  filterBody: { padding: 16, gap: 18, paddingBottom: 40 },
  ship: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 },
  group: { gap: 8 },
  groupTitle: { fontSize: 16, fontWeight: "700" },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
})
