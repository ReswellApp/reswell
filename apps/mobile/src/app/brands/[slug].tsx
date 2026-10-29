import { Stack, useLocalSearchParams, useRouter } from "expo-router"
import { useEffect, useState } from "react"
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native"
import type { MobileBrandModelCard, MobileBrandPage, MobileListingCard } from "@reswell/api-contract"
import { BrandPageHeader } from "@/components/brands/brand-page-header"
import { useFloatingTabBarContentInset } from "@/components/floating-tab-bar"
import { ListingCard } from "@/components/listing-card"
import { ScreenSearchHeader } from "@/components/screen-search-header"
import { fetchBrand } from "@/lib/api"
import { fontFamily, useReswellColors } from "@/theme"

export default function BrandScreen() {
  const colors = useReswellColors()
  const router = useRouter()
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const [brand, setBrand] = useState<MobileBrandPage | null>(null)
  const [tab, setTab] = useState<"listings" | "sold">("listings")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const tabBarInset = useFloatingTabBarContentInset()

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    setLoading(true)
    fetchBrand(slug)
      .then((next) => {
        if (!cancelled) {
          setBrand(next)
          setError(null)
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load this brand")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  const listings = tab === "sold" ? brand?.sold_listings ?? [] : brand?.listings ?? []
  const grid = listings.length % 2 === 1 ? [...listings, null] : listings

  function openListing(listing: MobileListingCard) {
    router.push({ pathname: "/listing/[id]", params: { id: listing.slug || listing.id } })
  }

  function openModel(model: MobileBrandModelCard) {
    if (!brand) return
    router.push({ pathname: "/brands/[slug]/[model]", params: { slug: brand.slug, model: model.slug } })
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenSearchHeader showBack />
      {loading ? (
        <ActivityIndicator style={styles.centered} color={colors.foreground} />
      ) : error || !brand ? (
        <View style={styles.centered}>
          <Text style={{ color: colors.foreground, fontFamily: fontFamily.text }}>{error ?? "Brand not found"}</Text>
        </View>
      ) : (
        <FlatList
          data={grid}
          extraData={tab}
          keyExtractor={(item) => item?.id ?? "spacer"}
          numColumns={2}
          columnWrapperStyle={grid.length > 0 ? styles.columns : undefined}
          contentContainerStyle={[styles.list, tabBarInset]}
          ListHeaderComponent={<BrandPageHeader brand={brand} tab={tab} onTab={setTab} onOpenModel={openModel} />}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.muted, fontFamily: fontFamily.text }]}>
              {tab === "sold" ? "No sold listings yet." : "No listings for sale right now."}
            </Text>
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
