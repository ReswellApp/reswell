import { Stack, useRouter } from "expo-router"
import { useEffect, useMemo, useState } from "react"
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import type { MobileBrandCard } from "@reswell/api-contract"
import { VerticalScroll } from "@/components/horizontal-rail"
import { fetchBrands } from "@/lib/api"
import { fontFamily, useReswellColors } from "@/theme"

export default function BrandsScreen() {
  const colors = useReswellColors()
  const router = useRouter()
  const [brands, setBrands] = useState<MobileBrandCard[]>([])
  const [query, setQuery] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

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

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: "Brands" }} />
      {loading ? (
        <ActivityIndicator style={styles.centered} color={colors.foreground} />
      ) : error ? (
        <View style={styles.centered}>
          <Text style={{ color: colors.foreground, fontFamily: fontFamily.text }}>{error}</Text>
        </View>
      ) : (
        <VerticalScroll contentContainerStyle={styles.list}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search brands"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.search, { color: colors.foreground, borderColor: colors.border, fontFamily: fontFamily.text }]}
          />
          {visible.map((brand) => (
            <Pressable
              key={brand.id}
              onPress={() => router.push({ pathname: "/brands/[slug]", params: { slug: brand.slug } })}
              style={[styles.row, { borderColor: colors.border }]}
            >
              <View style={styles.copy}>
                <Text style={[styles.name, { color: colors.foreground, fontFamily: fontFamily.text }]}>{brand.name}</Text>
                <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>
                  {brand.listing_count.toLocaleString("en-US")} for sale
                  {brand.model_count > 0 ? ` · ${brand.model_count.toLocaleString("en-US")} models` : ""}
                </Text>
              </View>
            </Pressable>
          ))}
        </VerticalScroll>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: 16, gap: 8 },
  search: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 10 },
  copy: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: "600" },
  meta: { fontSize: 13 },
})
