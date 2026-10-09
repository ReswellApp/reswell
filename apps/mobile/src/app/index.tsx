import { Stack, useFocusEffect, useRouter } from "expo-router"
import { useCallback, useEffect, useRef, useState } from "react"
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native"
<<<<<<< Updated upstream
import type { MobileBrowseChip, MobileHome, MobileListingCard, MobileListingsPage } from "@reswell/api-contract"
import { HomeFeed } from "@/components/home-feed"
=======
import {
  MOBILE_BOARD_STYLE_FILTERS,
  MOBILE_CATEGORY_CHIPS,
  type MobileBoardType,
  type MobileListingCategory,
  type MobileListingsPage,
} from "@reswell/api-contract"
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
  const searchRef = useRef(search)
  searchRef.current = search
=======
  const [category, setCategory] = useState<MobileListingCategory | null>(null)
  const [boardType, setBoardType] = useState<MobileBoardType | null>(null)
  const browseKey = `${category ?? ""}:${boardType ?? ""}`
  const searchRef = useRef(search)
  const browseRef = useRef(browseKey)
  searchRef.current = search
  browseRef.current = browseKey
>>>>>>> Stashed changes

  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 300)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    setPage(null)
<<<<<<< Updated upstream
  }, [search])

  const browsing = Boolean(search)
=======
  }, [search, category, boardType])
>>>>>>> Stashed changes

  const load = useCallback(() => {
    let cancelled = false
    const q = search
<<<<<<< Updated upstream
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
    fetchListings(0, { q: q || undefined })
=======
    const nextCategory = category
    const nextBoardType = boardType
    setLoading(true)
    fetchListings(0, listingsQuery(q, nextCategory, nextBoardType))
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
  }, [search, accessToken])
=======
  }, [search, category, boardType])
>>>>>>> Stashed changes

  useFocusEffect(load)

  function loadMore() {
    if (!page?.has_more || loadingMore || loading) return
    const q = search
<<<<<<< Updated upstream
    setLoadingMore(true)
    fetchListings(page.offset + page.limit, { q: q || undefined })
      .then((next) => {
        if (searchRef.current !== q) return
=======
    const key = browseKey
    setLoadingMore(true)
    fetchListings(page.offset + page.limit, listingsQuery(q, category, boardType))
      .then((next) => {
        if (searchRef.current !== q || browseRef.current !== key) return
>>>>>>> Stashed changes
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

  const listings = page?.listings ?? []
  const grid = listings.length % 2 === 1 ? [...listings, null] : listings

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <HomeHeader
        signedIn={Boolean(session)}
        onAccount={() => router.push(session ? "/account" : "/sign-in")}
<<<<<<< Updated upstream
        onOpenCategory={(chip: MobileBrowseChip) =>
          router.push({
            pathname: "/category/[slug]",
            params: chip.board_type ? { slug: chip.category, type: chip.board_type } : { slug: chip.category },
          })
        }
=======
        category={category}
        boardType={boardType}
        onSelectCategory={(next) => {
          setCategory(next)
          setBoardType(null)
        }}
        onSelectBoardType={setBoardType}
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
              {search ? "No listings match that search." : "No listings yet."}
=======
              {search
                ? "No listings match that search."
                : browseLabel(category, boardType)
                  ? `No ${browseLabel(category, boardType)} listings yet.`
                  : "No listings yet."}
>>>>>>> Stashed changes
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

<<<<<<< Updated upstream
=======
function listingsQuery(
  q: string,
  category: MobileListingCategory | null,
  boardType: MobileBoardType | null,
): { q?: string; category?: string; board_type?: string } {
  return {
    q: q || undefined,
    category: category ?? undefined,
    board_type: category === "surfboards" ? boardType ?? undefined : undefined,
  }
}

function browseLabel(category: MobileListingCategory | null, boardType: MobileBoardType | null): string | null {
  if (boardType) {
    return MOBILE_BOARD_STYLE_FILTERS.find((filter) => filter.board_type === boardType)?.label.toLowerCase() ?? null
  }
  if (category) {
    return MOBILE_CATEGORY_CHIPS.find((chip) => chip.category === category)?.label.toLowerCase() ?? null
  }
  return null
}

>>>>>>> Stashed changes
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
