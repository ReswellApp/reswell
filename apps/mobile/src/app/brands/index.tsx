import { Stack, useRouter } from "expo-router"
import { useEffect, useMemo, useState } from "react"
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, View } from "react-native"
import type { MobileBrandCard } from "@reswell/api-contract"
import { BrandDirectoryCard } from "@/components/brands/brand-directory-card"
import { useFloatingTabBarContentInset } from "@/components/floating-tab-bar"
import { ScreenSearchHeader } from "@/components/screen-search-header"
import { SCREEN_GUTTER } from "@/components/screen-shell"
import { fetchBrands } from "@/lib/api"
import { fontFamily, useReswellColors } from "@/theme"

export default function BrandsScreen() {
  const colors = useReswellColors()
  const router = useRouter()
  const [brands, setBrands] = useState<MobileBrandCard[]>([])
  const [query, setQuery] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const tabBarInset = useFloatingTabBarContentInset()

  useEffect(() => {
    let cancelled = false
    fetchBrands()
      .then((page) => {
        if (!cancelled) {
          setBrands(page.brands)
          setError(null)
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load brands")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return brands
    return brands.filter((brand) => brand.name.toLowerCase().includes(q))
  }, [brands, query])
  const grid = visible.length % 2 === 1 ? [...visible, null] : visible

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenSearchHeader showBack />
      {loading ? (
        <ActivityIndicator style={styles.centered} color={colors.foreground} />
      ) : error ? (
        <View style={styles.centered}>
          <Text style={{ color: colors.foreground, fontFamily: fontFamily.text }}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={grid}
          keyExtractor={(item, index) => item?.id ?? `spacer-${index}`}
          numColumns={2}
          columnWrapperStyle={grid.length > 0 ? styles.columns : undefined}
          contentContainerStyle={[styles.list, tabBarInset]}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={[styles.hero, { borderBottomColor: colors.border, backgroundColor: colors.secondary }]}>
              <Text style={[styles.pageTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
                Surf Brands
              </Text>
              <Text style={[styles.description, { color: colors.muted, fontFamily: fontFamily.text }]}>
                Shapers and labels in the Reswell catalog.
              </Text>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search brands"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                autoCorrect={false}
                clearButtonMode="while-editing"
                style={[
                  styles.search,
                  {
                    color: colors.foreground,
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                    fontFamily: fontFamily.text,
                  },
                ]}
              />
            </View>
          }
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.muted, fontFamily: fontFamily.text }]}>
              {query.trim() ? "No brands match that search." : "No brands yet."}
            </Text>
          }
          renderItem={({ item }) =>
            item ? (
              <View style={styles.cell}>
                <BrandDirectoryCard
                  brand={item}
                  onPress={() => router.push({ pathname: "/brands/[slug]", params: { slug: item.slug } })}
                />
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
  list: { paddingBottom: 16 },
  hero: {
    paddingHorizontal: SCREEN_GUTTER,
    paddingTop: 16,
    paddingBottom: 18,
    marginBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  pageTitle: { fontSize: 26, lineHeight: 30, fontWeight: "700", textAlign: "center" },
  description: { fontSize: 15, lineHeight: 22, textAlign: "center" },
  search: {
    marginTop: 6,
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  columns: { paddingHorizontal: 12, gap: 12, marginBottom: 12 },
  cell: { flex: 1 },
  empty: { textAlign: "center", paddingHorizontal: 24, paddingVertical: 32, fontSize: 15, lineHeight: 21 },
})
