import { Stack, useLocalSearchParams, useRouter } from "expo-router"
import { useEffect, useState } from "react"
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native"
import type { MobileBrandPage, MobileListingCard } from "@reswell/api-contract"
import { ScreenSearchHeader } from "@/components/screen-search-header"
import { HorizontalRail } from "@/components/horizontal-rail"
import { ListingCard } from "@/components/listing-card"
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
          keyExtractor={(item) => item?.id ?? "spacer"}
          numColumns={2}
          columnWrapperStyle={styles.columns}
          ListHeaderComponent={
            <View style={styles.header}>
              <View style={styles.titleRow}>
                <View style={styles.titleCopy}>
                  <Text style={[styles.title, { color: colors.foreground, fontFamily: fontFamily.headline }]}>{brand.name}</Text>
                  {brand.location_label ? (
                    <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>{brand.location_label}</Text>
                  ) : null}
                </View>
              </View>
              {brand.short_description ? (
                <Text style={[styles.body, { color: colors.foreground, fontFamily: fontFamily.text }]}>{brand.short_description}</Text>
              ) : null}
              {brand.lead_shaper_name || brand.founder_name ? (
                <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>
                  {[brand.lead_shaper_name ? `Shaped by ${brand.lead_shaper_name}` : null, brand.founder_name ? `Founded by ${brand.founder_name}` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              ) : null}
              {brand.models.length > 0 ? (
                <View style={styles.models}>
                  <Text style={[styles.section, { color: colors.foreground, fontFamily: fontFamily.headline }]}>Models</Text>
                  <HorizontalRail contentStyle={styles.modelRail}>
                    {brand.models.map((model) => (
                      <Pressable
                        key={model.id}
                        onPress={() =>
                          router.push({ pathname: "/brands/[slug]/[model]", params: { slug: brand.slug, model: model.slug } })
                        }
                        style={styles.model}
                      >
                        <Text numberOfLines={2} style={[styles.modelName, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                          {model.name}
                        </Text>
                      </Pressable>
                    ))}
                  </HorizontalRail>
                </View>
              ) : null}
              <View style={styles.tabs}>
                {(["listings", "sold"] as const).map((value) => {
                  const active = tab === value
                  const label = value === "listings" ? "For sale" : "Sold"
                  return (
                    <Pressable key={value} onPress={() => setTab(value)} style={[styles.tab, active ? { backgroundColor: colors.foreground } : { backgroundColor: colors.image }]}>
                      <Text style={[styles.tabLabel, { color: active ? colors.primaryForeground : colors.foreground, fontFamily: fontFamily.text }]}>
                        {label}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            </View>
          }
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
  columns: { paddingHorizontal: 12, gap: 8 },
  header: { paddingHorizontal: 16, paddingTop: 8, gap: 10 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  titleCopy: { flex: 1, gap: 2 },
  title: { fontSize: 28, fontWeight: "700", letterSpacing: -0.4 },
  meta: { fontSize: 14 },
  body: { fontSize: 15, lineHeight: 21 },
  models: { gap: 8, marginTop: 8 },
  section: { fontSize: 20, fontWeight: "700" },
  modelRail: { gap: 12, paddingRight: 16 },
  model: { width: 112, gap: 6 },
  modelName: { fontSize: 13, fontWeight: "600" },
  tabs: { flexDirection: "row", gap: 8, marginTop: 8, marginBottom: 12 },
  tab: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  tabLabel: { fontSize: 14, fontWeight: "600" },
  cell: { flex: 1 },
  empty: { paddingHorizontal: 16, paddingVertical: 24, fontSize: 15 },
})
