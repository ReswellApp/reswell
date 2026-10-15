import { Stack, useLocalSearchParams, useRouter } from "expo-router"
import { useEffect, useState } from "react"
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native"
import type { MobileListingCard, MobileSearchResults } from "@reswell/api-contract"
import { ListingCard } from "@/components/listing-card"
import { SaveSearchCard } from "@/components/save-search-card"
import { fetchSavedSearch, fetchSearchResults } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { fontFamily, useReswellColors } from "@/theme"

export default function SearchResultsScreen() {
  const colors = useReswellColors()
  const router = useRouter()
  const { session } = useAuth()
  const params = useLocalSearchParams<{ q?: string }>()
  const query = typeof params.q === "string" ? params.q.trim() : ""
  const [listings, setListings] = useState<MobileListingCard[]>([])
  const [summary, setSummary] = useState<MobileSearchResults["summary"]>(null)
  const [savedSearchId, setSavedSearchId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (query.length < 2) {
      setListings([])
      setSummary(null)
      setLoading(false)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    fetchSearchResults(query)
      .then((result) => {
        if (cancelled) return
        if (result.browse) {
          router.replace({
            pathname: "/category/[slug]",
            params: {
              slug: result.browse.category,
              ...(result.browse.board_type ? { type: result.browse.board_type } : {}),
            },
          })
          return
        }
        setListings(result.listings)
        setSummary(result.summary)
        setError(null)
        setLoading(false)
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Unable to load search results")
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [query, router])

  useEffect(() => {
    const token = session?.access_token
    if (!token || query.length < 2) {
      setSavedSearchId(null)
      return
    }
    let cancelled = false
    fetchSavedSearch(token, query)
      .then((result) => {
        if (!cancelled) setSavedSearchId(result.saved_search_id)
      })
      .catch(() => {
        if (!cancelled) setSavedSearchId(null)
      })
    return () => {
      cancelled = true
    }
  }, [query, session?.access_token])

  const grid = listings.length % 2 === 1 ? [...listings, null] : listings
  const detail = summaryDetail(summary)

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: "" }} />
      {loading ? (
        <ActivityIndicator style={styles.centered} color={colors.foreground} />
      ) : error ? (
        <View style={styles.centered}>
          <Text style={{ color: colors.foreground, fontFamily: fontFamily.text }}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={grid}
          keyExtractor={(item) => item?.id ?? "spacer"}
          numColumns={2}
          columnWrapperStyle={listings.length > 0 ? styles.columns : undefined}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              <Text style={[styles.heading, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
                {query ? `Results for “${query}”` : "Search"}
              </Text>
              {detail ? (
                <Text style={[styles.subtitle, { color: colors.muted, fontFamily: fontFamily.text }]}>
                  {detail}
                  {summary?.model ? (
                    <>
                      {" · "}
                      <Text
                        onPress={() => router.push({ pathname: "/category/[slug]", params: { slug: "surfboards" } })}
                        style={[styles.more, { color: colors.foreground, fontFamily: fontFamily.text }]}
                      >
                        More filters
                      </Text>
                    </>
                  ) : null}
                </Text>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.muted, fontFamily: fontFamily.text }]}>
              No listings match that search.
            </Text>
          }
          ListFooterComponent={
            query.length >= 2 ? (
              <SaveSearchCard
                query={query}
                accessToken={session?.access_token ?? null}
                savedSearchId={savedSearchId}
                onSignIn={() => router.push("/sign-in")}
                onChange={setSavedSearchId}
              />
            ) : null
          }
          renderItem={({ item }) =>
            item ? (
              <ListingCard
                item={item}
                onPress={() => router.push({ pathname: "/listing/[id]", params: { id: item.slug || item.id } })}
              />
            ) : (
              <View style={styles.spacer} />
            )
          }
        />
      )}
    </View>
  )
}

function summaryDetail(summary: MobileSearchResults["summary"]): string | null {
  if (!summary) return null
  if (summary.model) {
    return [summary.model, summary.brand, summary.length].filter(Boolean).join(" · ")
  }
  return summary.brand
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { paddingTop: 8, paddingBottom: 120, paddingHorizontal: 12 },
  columns: { gap: 12 },
  header: { marginHorizontal: 4, paddingBottom: 16, marginBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  heading: { fontSize: 28, fontWeight: "700", letterSpacing: -0.4 },
  subtitle: { marginTop: 6, fontSize: 15, lineHeight: 20 },
  more: { fontWeight: "600", textDecorationLine: "underline" },
  empty: { textAlign: "center", marginTop: 32, fontSize: 16 },
  spacer: { flex: 1 },
})
