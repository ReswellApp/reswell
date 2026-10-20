import { Stack, useRouter } from "expo-router"
import { useEffect, useState } from "react"
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { SymbolView } from "expo-symbols"
import { AccountRow } from "@/components/account-row"
import { fetchSellCatalog } from "@/lib/api"
import type { MobileSellCatalogRow } from "@reswell/api-contract"
import { fontFamily, useReswellColors } from "@/theme"

const DEBOUNCE_MS = 180

export default function SellHubScreen() {
  const colors = useReswellColors()
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<MobileSellCatalogRow[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const trimmed = query.trim()

  useEffect(() => {
    if (trimmed.length < 1) {
      setSearching(false)
      setError(null)
      setResults([])
      return
    }
    let cancelled = false
    const timer = setTimeout(() => {
      setSearching(true)
      setError(null)
      fetchSellCatalog(trimmed)
        .then((data) => {
          if (!cancelled) setResults(data.results)
        })
        .catch((cause: unknown) => {
          if (!cancelled) {
            setResults([])
            setError(cause instanceof Error ? cause.message : "Could not search the catalog")
          }
        })
        .finally(() => {
          if (!cancelled) setSearching(false)
        })
    }, DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [trimmed])

  const visibleResults = trimmed.length < 1 ? [] : results

  function openScratch() {
    router.push("/sell/new")
  }

  function openResult(row: MobileSellCatalogRow) {
    router.push({
      pathname: "/sell/new",
      params: {
        title: row.model_name ? row.title : "",
        brand: row.brand_name,
        model: row.model_name ?? "",
        category: row.category,
        subcategory: row.board_type ?? "",
      },
    })
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.list}
    >
      <Stack.Screen options={{ title: "Sell" }} />
      <Text style={[styles.title, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
        Tell us what you're selling
      </Text>
      <View style={[styles.search, { borderColor: colors.border, backgroundColor: colors.image }]}>
        <SymbolView
          name={{ ios: "magnifyingglass", android: "search", web: "search" }}
          size={18}
          tintColor={colors.muted}
        />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Brand and model name"
          placeholderTextColor={colors.muted}
          autoCapitalize="words"
          autoCorrect={false}
          style={[styles.input, { color: colors.foreground, fontFamily: fontFamily.text }]}
        />
      </View>
      <Text style={[styles.helper, { color: colors.muted, fontFamily: fontFamily.text }]}>
        Search the catalog and we’ll fill in the brand, model, and category.
      </Text>
      <Pressable accessibilityRole="button" onPress={openScratch} style={styles.scratch} hitSlop={8}>
        <Text style={[styles.link, { color: colors.foreground, fontFamily: fontFamily.text }]}>
          Start your listing from scratch.
        </Text>
      </Pressable>
      {searching ? (
        <Text style={[styles.status, { color: colors.muted, fontFamily: fontFamily.text }]}>Searching…</Text>
      ) : null}
      {error ? <Text style={[styles.status, { color: colors.destructive, fontFamily: fontFamily.text }]}>{error}</Text> : null}
      {visibleResults.length > 0 ? (
        <Text style={[styles.group, { color: colors.foreground, fontFamily: fontFamily.text }]}>Suggested</Text>
      ) : null}
      {visibleResults.map((row) => (
        <AccountRow
          key={`${row.kind}-${row.id}`}
          title={row.title}
          subtitle={row.model_name ? `${row.brand_name} · ${row.category_label}` : row.category_label}
          onPress={() => openResult(row)}
        />
      ))}
      {trimmed.length > 1 && !searching && !error && visibleResults.length === 0 ? (
        <Pressable accessibilityRole="button" onPress={openScratch} style={styles.empty}>
          <Text style={[styles.status, { color: colors.foreground, fontFamily: fontFamily.text }]}>
            Nothing in the catalog matches that. Start this listing from scratch.
          </Text>
        </Pressable>
      ) : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  list: { paddingBottom: 120 },
  title: { fontSize: 28, fontWeight: "600", paddingHorizontal: 16, paddingTop: 8 },
  search: {
    marginHorizontal: 16,
    marginTop: 16,
    minHeight: 48,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: 12 },
  helper: { fontSize: 15, lineHeight: 22, paddingHorizontal: 16, paddingTop: 14 },
  scratch: { alignSelf: "flex-start", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  link: { fontSize: 15, fontWeight: "600", textDecorationLine: "underline" },
  status: { fontSize: 15, paddingHorizontal: 16, paddingTop: 16 },
  group: { fontSize: 13, fontWeight: "700", paddingHorizontal: 16, paddingTop: 20, paddingBottom: 4 },
  empty: { paddingTop: 4 },
})
