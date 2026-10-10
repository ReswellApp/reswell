import { Stack, useFocusEffect, useRouter } from "expo-router"
import { useCallback, useEffect, useRef, useState } from "react"
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import type { MobileBrowseRail, MobileHome, MobileListingCard, MobileListingCategory, MobileListingsPage } from "@reswell/api-contract"
import { CategorySlider } from "@/components/browse-chips"
import { HomeFeed } from "@/components/home-feed"
import { HomeHeader } from "@/components/home-header"
import { ListingCard } from "@/components/listing-card"
import { fetchBrowseRail, fetchHome, fetchListings, fetchRecentlyViewed } from "@/lib/api"
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
  const [rail, setRail] = useState<MobileBrowseRail | null>(null)
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
    fetchBrowseRail()
      .then((next) => {
        if (!cancelled) setRail(next)
      })
      .catch(() => undefined)
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

  function openResource(screen: string) {
    router.push({ pathname: "/seller-resources/[slug]", params: { slug: screen } })
  }

  const listings = page?.listings ?? []
  const grid = listings.length % 2 === 1 ? [...listings, null] : listings

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <HomeHeader
        query={query}
        onQueryChange={setQuery}
        onNotifications={() => router.push(session ? "/account/messages" : "/sign-in")}
        onCart={() => router.push(session ? "/account/cart" : "/sign-in")}
      />
      {loading && (browsing ? !page : !home) ? (
        <ScrollView>
          <CategorySlider items={rail?.items ?? null} onOpenCategory={openCategory} onOpenResource={openResource} />
          <ActivityIndicator style={styles.centered} color={colors.foreground} />
        </ScrollView>
      ) : error && (browsing ? !page : !home) ? (
        <ScrollView>
          <CategorySlider items={rail?.items ?? null} onOpenCategory={openCategory} onOpenResource={openResource} />
          <View style={styles.centered}>
            <Text style={{ color: colors.foreground, fontFamily: fontFamily.text }}>{error}</Text>
            <Pressable onPress={load}>
              <Text style={[styles.headerAction, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                Try again
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      ) : browsing ? (
        <FlatList
          data={grid}
          ListHeaderComponent={<CategorySlider items={rail?.items ?? null} onOpenCategory={openCategory} onOpenResource={openResource} />}
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
          onOpenCategory={openCategory}
          onOpenResource={openResource}
          rail={rail?.items ?? null}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  headerAction: { fontSize: 16, fontWeight: "600" },
  list: { paddingTop: 8, paddingBottom: 120 },
  row: { gap: 12, paddingHorizontal: 12 },
  empty: { textAlign: "center", marginTop: 48, fontSize: 16 },
  footer: { marginVertical: 16 },
  spacer: { flex: 1 },
})
