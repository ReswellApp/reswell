import { Stack, useFocusEffect, useRouter } from "expo-router"
import { useCallback, useState } from "react"
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native"
import type { MobileListingsPage } from "@reswell/api-contract"
import { ListingCard } from "@/components/listing-card"
import { Wordmark } from "@/components/wordmark"
import { fetchListings } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { fontFamily, useReswellColors } from "@/theme"

export default function ListingsScreen() {
  const colors = useReswellColors()
  const router = useRouter()
  const { session } = useAuth()
  const [page, setPage] = useState<MobileListingsPage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const load = useCallback(() => {
    let cancelled = false
    setLoading(true)
    fetchListings()
      .then((next) => {
        if (!cancelled) {
          setPage(next)
          setError(null)
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load listings")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useFocusEffect(load)

  function loadMore() {
    if (!page?.has_more || loadingMore || loading) return
    setLoadingMore(true)
    fetchListings(page.offset + page.limit)
      .then((next) => {
        setPage({
          ...next,
          listings: [...page.listings, ...next.listings],
        })
      })
      .catch(() => undefined)
      .finally(() => setLoadingMore(false))
  }

  const listings = page?.listings ?? []
  const grid = listings.length % 2 === 1 ? [...listings, null] : listings

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          headerTitle: "",
          headerLeft: () => <Wordmark />,
          headerRight: () => (
            <Pressable onPress={() => router.push("/sign-in")} hitSlop={8}>
              <Text style={[styles.headerAction, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                {session ? "Account" : "Sign in"}
              </Text>
            </Pressable>
          ),
        }}
      />
      {loading && !page ? (
        <ActivityIndicator style={styles.centered} color={colors.foreground} />
      ) : error && !page ? (
        <View style={styles.centered}>
          <Text style={{ color: colors.foreground, fontFamily: fontFamily.text }}>{error}</Text>
          <Pressable onPress={load}>
            <Text style={[styles.headerAction, { color: colors.foreground, fontFamily: fontFamily.text }]}>
              Try again
            </Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={grid}
          keyExtractor={(item) => item?.id ?? "spacer"}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          refreshing={loading}
          onRefresh={load}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.muted, fontFamily: fontFamily.text }]}>No listings yet.</Text>
          }
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color={colors.foreground} style={styles.footer} /> : null
          }
          renderItem={({ item }) =>
            item ? (
              <ListingCard
                item={item}
                onPress={() =>
                  router.push({
                    pathname: "/listing/[id]",
                    params: { id: item.slug || item.id },
                  })
                }
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

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  headerAction: { fontSize: 16, fontWeight: "600" },
  list: { paddingTop: 8, paddingBottom: 28 },
  row: { gap: 12, paddingHorizontal: 12 },
  empty: { textAlign: "center", marginTop: 48, fontSize: 16 },
  footer: { marginVertical: 16 },
  spacer: { flex: 1 },
})
