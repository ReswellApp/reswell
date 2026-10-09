import { Stack, useFocusEffect, useRouter } from "expo-router"
import { useCallback, useEffect, useRef, useState } from "react"
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import type { MobileHome, MobileListingCard, MobileListingCategory, MobileListingsPage } from "@reswell/api-contract"
import { HomeFeed } from "@/components/home-feed"
import { HomeHeader } from "@/components/home-header"
import { ListingCard } from "@/components/listing-card"
import { fetchHome, fetchListings, fetchRecentlyViewed } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { fontFamily, useReswellColors } from "@/theme"

export default function ListingsScreen() {
  const colors = useReswellColors()
  const router = useRouter()
  const { session } = useAuth()
  const accessToken = session?.access_token ?? null
  const [page, setPage] = useState<MobileListingsPage | null>(null)
  const [home, setHome] = useState<MobileHome | null>(null)
  const [continueListings, setContinueListings] = useState<MobileListingCard[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [query, setQuery] = useState("")
  const [search, setSearch] = useState("")
  const searchRef = useRef(search)
  searchRef.current = search

  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 300)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    setPage(null)
  }, [search])

  const browsing = Boolean(search)

  const load = useCallback(() => {
    let cancelled = false
    const q = search
    setLoading(true)
    if (!q) {
      const recent = accessToken
        ? fetchRecentlyViewed(accessToken).catch(() => ({ listings: [] }))
        : Promise.resolve({ listings: [] })
      Promise.all([fetchHome(), recent])
        .then(([next, viewed]) => {
          if (!cancelled) {
            setHome(next)
            setContinueListings(viewed.listings)
            setError(null)
          }
        })
        .catch((cause: unknown) => {
          if (!cancelled) {
            setHome(null)
            setContinueListings([])
            setError(cause instanceof Error ? cause.message : "Unable to load the homepage")
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
      return () => {
        cancelled = true
      }
    }
    fetchListings(0, { q })
      .then((next) => {
        if (!cancelled) {
          setPage(next)
          setError(null)
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setPage(null)
          setError(cause instanceof Error ? cause.message : "Unable to load listings")
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [search, accessToken])

  useFocusEffect(load)

  function loadMore() {
    if (!page?.has_more || loadingMore || loading || !search) return
    const q = search
    setLoadingMore(true)
    fetchListings(page.offset + page.limit, { q })
      .then((next) => {
        if (searchRef.current !== q) return
        setPage((current) =>
          current
            ? { ...next, listings: [...current.listings, ...next.listings] }
            : next,
        )
      })
      .catch(() => undefined)
      .finally(() => setLoadingMore(false))
  }

  function openListing(id: string) {
    router.push({ pathname: "/listing/[id]", params: { id } })
  }

  function openCategory(category: MobileListingCategory) {
    router.push({ pathname: "/category/[slug]", params: { slug: category } })
  }

  const listings = page?.listings ?? []
  const grid = listings.length % 2 === 1 ? [...listings, null] : listings

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <HomeHeader
        signedIn={Boolean(session)}
        onAccount={() => router.push(session ? "/account" : "/sign-in")}
        onOpenCategory={openCategory}
      />
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search boards, brands, models"
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        returnKeyType="search"
        style={[
          styles.search,
          { color: colors.foreground, backgroundColor: colors.image, fontFamily: fontFamily.text },
        ]}
      />
      {loading && (browsing ? !page : !home) ? (
        <ActivityIndicator style={styles.centered} color={colors.foreground} />
      ) : error && (browsing ? !page : !home) ? (
        <View style={styles.centered}>
          <Text style={{ color: colors.foreground, fontFamily: fontFamily.text }}>{error}</Text>
          <Pressable onPress={load}>
            <Text style={[styles.headerAction, { color: colors.foreground, fontFamily: fontFamily.text }]}>
              Try again
            </Text>
          </Pressable>
        </View>
      ) : browsing ? (
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
            <Text style={[styles.empty, { color: colors.muted, fontFamily: fontFamily.text }]}>
              {search ? "No listings match that search." : "No listings yet."}
            </Text>
          }
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color={colors.foreground} style={styles.footer} /> : null
          }
          renderItem={({ item }) =>
            item ? (
              <ListingCard
                item={item}
                onPress={() => openListing(item.slug || item.id)}
              />
            ) : (
              <View style={styles.spacer} />
            )
          }
        />
      ) : (
        <HomeFeed
          sections={home?.sections ?? []}
          continueListings={continueListings}
          refreshing={loading}
          onRefresh={load}
          onOpenListing={(listing) => openListing(listing.slug || listing.id)}
          onOpenShop={(slug) => router.push({ pathname: "/profile/[slug]", params: { slug } })}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  headerAction: { fontSize: 16, fontWeight: "600" },
  search: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
  },
  list: { paddingTop: 8, paddingBottom: 120 },
  row: { gap: 12, paddingHorizontal: 12 },
  empty: { textAlign: "center", marginTop: 48, fontSize: 16 },
  footer: { marginVertical: 16 },
  spacer: { flex: 1 },
})
