import { Image } from "expo-image"
import { Stack, useLocalSearchParams, useRouter } from "expo-router"
import { useEffect, useState } from "react"
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native"
import type { MobileListingCard, MobileModelPage } from "@reswell/api-contract"
import { ListingCard } from "@/components/listing-card"
import { fetchModel } from "@/lib/api"
import { fontFamily, useReswellColors } from "@/theme"

export default function ModelScreen() {
  const colors = useReswellColors()
  const router = useRouter()
  const { slug, model } = useLocalSearchParams<{ slug: string; model: string }>()
  const [page, setPage] = useState<MobileModelPage | null>(null)
  const [tab, setTab] = useState<"listings" | "sold">("listings")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

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

  const listings = tab === "sold" ? page?.sold_listings ?? [] : page?.listings ?? []
  const grid = listings.length % 2 === 1 ? [...listings, null] : listings

  function openListing(listing: MobileListingCard) {
    router.push({ pathname: "/listing/[id]", params: { id: listing.slug || listing.id } })
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: page?.name ?? "Model" }} />
      {loading ? (
        <ActivityIndicator style={styles.centered} color={colors.foreground} />
      ) : error || !page ? (
        <View style={styles.centered}>
          <Text style={{ color: colors.foreground, fontFamily: fontFamily.text }}>{error ?? "Model not found"}</Text>
        </View>
      ) : (
        <FlatList
          data={grid}
          keyExtractor={(item) => item?.id ?? "spacer"}
          numColumns={2}
          columnWrapperStyle={styles.columns}
          contentContainerStyle={styles.list}
          ListHeaderComponent={<ModelHeader page={page} tab={tab} onTab={setTab} onBrand={() => router.push({ pathname: "/brands/[slug]", params: { slug: page.brand_slug } })} />}
          ListFooterComponent={<ModelReviews page={page} />}
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

function ModelHeader({
  page,
  tab,
  onTab,
  onBrand,
}: {
  page: MobileModelPage
  tab: "listings" | "sold"
  onTab: (tab: "listings" | "sold") => void
  onBrand: () => void
}) {
  const colors = useReswellColors()
  return (
    <View style={styles.header}>
      {page.hero_image_url ? (
        <Image source={{ uri: page.hero_image_url }} style={[styles.hero, { backgroundColor: colors.image }]} contentFit="cover" />
      ) : null}
      <Text style={[styles.brand, { color: colors.foreground, fontFamily: fontFamily.text }]} onPress={onBrand}>
        {page.brand_name}
      </Text>
      <Text style={[styles.title, { color: colors.foreground, fontFamily: fontFamily.headline }]}>{page.name}</Text>
      <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>{page.category_label}</Text>
      {page.description ? (
        <Text style={[styles.body, { color: colors.foreground, fontFamily: fontFamily.text }]}>{page.description}</Text>
      ) : null}
      {page.variants.length > 0 ? (
        <View style={styles.chips}>
          {page.variants.map((variant) => (
            <View key={variant.id} style={[styles.chip, { backgroundColor: colors.image }]}>
              <Text style={[styles.chipLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>{variant.label}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <View style={[styles.guide, { backgroundColor: colors.image }]}>
        <Text style={[styles.guideLabel, { color: colors.muted, fontFamily: fontFamily.text }]}>Price guide</Text>
        {page.price_guide ? (
          <>
            <Text style={[styles.guideRange, { color: colors.foreground, fontFamily: fontFamily.headline }]}>{page.price_guide.range_label}</Text>
            <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>
              Sold median {page.price_guide.sold_median_label} · Asking {page.price_guide.asking_median_label} · {page.price_guide.sold_count} sold · {page.price_guide.confidence_label}
            </Text>
            {page.price_guide.bands.map((band) => (
              <Text key={band.condition_label} style={[styles.band, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                {band.condition_label} · {band.typical_label} · {band.comps} comps
              </Text>
            ))}
          </>
        ) : (
          <Text style={[styles.body, { color: colors.muted, fontFamily: fontFamily.text }]}>We&apos;re still gathering sold comps for this model.</Text>
        )}
      </View>
      <View style={styles.tabs}>
        {(["listings", "sold"] as const).map((value) => {
          const active = tab === value
          return (
            <Pressable key={value} onPress={() => onTab(value)} style={[styles.tab, active ? { backgroundColor: colors.foreground } : { backgroundColor: colors.image }]}>
              <Text style={[styles.tabLabel, { color: active ? colors.primaryForeground : colors.foreground, fontFamily: fontFamily.text }]}>
                {value === "listings" ? "For sale" : "Sold"}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

function ModelReviews({ page }: { page: MobileModelPage }) {
  const colors = useReswellColors()
  return (
    <View style={styles.reviews}>
      <Text style={[styles.section, { color: colors.foreground, fontFamily: fontFamily.headline }]}>Reviews</Text>
      <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>
        {page.review_count === 0 ? "No reviews yet." : `${page.review_average.toFixed(1)} · ${page.review_count} reviews`}
      </Text>
      {page.reviews.map((review) => (
        <View key={review.id} style={[styles.review, { borderColor: colors.border }]}>
          <Text style={[styles.reviewAuthor, { color: colors.foreground, fontFamily: fontFamily.text }]}>
            {review.author_name} · {review.rating.toFixed(1)}
          </Text>
          {review.comment ? (
            <Text style={[styles.body, { color: colors.foreground, fontFamily: fontFamily.text }]}>{review.comment}</Text>
          ) : null}
          {review.created_label ? (
            <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>{review.created_label}</Text>
          ) : null}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  list: { paddingBottom: 120 },
  columns: { paddingHorizontal: 12, gap: 8 },
  header: { paddingHorizontal: 16, paddingTop: 8, gap: 8 },
  hero: { width: "100%", height: 220, borderRadius: 16 },
  brand: { fontSize: 15, fontWeight: "700", textDecorationLine: "underline" },
  title: { fontSize: 28, fontWeight: "700", letterSpacing: -0.4 },
  meta: { fontSize: 14 },
  body: { fontSize: 15, lineHeight: 21 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  chipLabel: { fontSize: 13, fontWeight: "600" },
  guide: { borderRadius: 16, padding: 16, gap: 6, marginTop: 4 },
  guideLabel: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  guideRange: { fontSize: 24, fontWeight: "700" },
  band: { fontSize: 14 },
  tabs: { flexDirection: "row", gap: 8, marginTop: 8, marginBottom: 12 },
  tab: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  tabLabel: { fontSize: 14, fontWeight: "600" },
  cell: { flex: 1 },
  empty: { paddingHorizontal: 16, paddingBottom: 12, fontSize: 15 },
  reviews: { paddingHorizontal: 16, paddingTop: 20, gap: 8 },
  section: { fontSize: 20, fontWeight: "700" },
  review: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 10, gap: 4 },
  reviewAuthor: { fontSize: 14, fontWeight: "700" },
})
