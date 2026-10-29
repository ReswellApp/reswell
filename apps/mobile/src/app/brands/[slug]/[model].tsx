import { Stack, useLocalSearchParams, useRouter } from "expo-router"
import { useEffect, useState } from "react"
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native"
import type { MobileListingCard, MobileModelPage } from "@reswell/api-contract"
import { ModelPageHeader, type ModelCatalogTab } from "@/components/brands/model-page-header"
import { ModelReviews } from "@/components/brands/model-reviews"
import { useFloatingTabBarContentInset } from "@/components/floating-tab-bar"
import { ListingCard } from "@/components/listing-card"
import { ScreenSearchHeader } from "@/components/screen-search-header"
import { fetchModel } from "@/lib/api"
import { fontFamily, useReswellColors } from "@/theme"

export default function ModelScreen() {
  const colors = useReswellColors()
  const router = useRouter()
  const { slug, model } = useLocalSearchParams<{ slug: string; model: string }>()
  const [page, setPage] = useState<MobileModelPage | null>(null)
  const [tab, setTab] = useState<ModelCatalogTab>("listings")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const tabBarInset = useFloatingTabBarContentInset()

  useEffect(() => {
    if (!slug || !model) return
    let cancelled = false
    setLoading(true)
    fetchModel(slug, model)
      .then((next) => {
        if (!cancelled) {
          setPage(next)
          setError(null)
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load this model")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [slug, model])

  const showingListings = tab !== "reviews"
  const listings = tab === "sold" ? page?.sold_listings ?? [] : page?.listings ?? []
  const grid = showingListings ? (listings.length % 2 === 1 ? [...listings, null] : listings) : []

  function openListing(listing: MobileListingCard) {
    router.push({ pathname: "/listing/[id]", params: { id: listing.slug || listing.id } })
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenSearchHeader showBack />
      {loading ? (
        <ActivityIndicator style={styles.centered} color={colors.foreground} />
      ) : error || !page ? (
        <View style={styles.centered}>
          <Text style={{ color: colors.foreground, fontFamily: fontFamily.text }}>{error ?? "Model not found"}</Text>
        </View>
      ) : (
        <FlatList
          data={grid}
          extraData={tab}
          keyExtractor={(item) => item?.id ?? "spacer"}
          numColumns={2}
          columnWrapperStyle={grid.length > 0 ? styles.columns : undefined}
          contentContainerStyle={[styles.list, tabBarInset]}
          ListHeaderComponent={
            <ModelPageHeader
              page={page}
              tab={tab}
              onTab={setTab}
              onBrand={() => router.push({ pathname: "/brands/[slug]", params: { slug: page.brand_slug } })}
            />
          }
          ListEmptyComponent={
            tab === "reviews" ? (
              <ModelReviews page={page} />
            ) : (
              <Text style={[styles.empty, { color: colors.muted, fontFamily: fontFamily.text }]}>
                {tab === "sold" ? "No sold listings yet." : "No listings for sale right now."}
              </Text>
            )
          }
          renderItem={({ item }) =>
            item ? (
              <View style={styles.cell}>
                <ListingCard item={item} badge={tab === "sold" ? "Sold" : undefined} onPress={() => openListing(item)} />
              </View>
            ) : (
              <View style={styles.cell} />
            )
          }
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  list: { paddingBottom: 12 },
  columns: { paddingHorizontal: 12, gap: 12 },
  cell: { flex: 1 },
  empty: { textAlign: "center", paddingHorizontal: 24, paddingVertical: 28, fontSize: 15, lineHeight: 21 },
})
