import { Image } from "expo-image"
import { useRouter } from "expo-router"
import { SymbolView } from "expo-symbols"
import { useEffect, useState } from "react"
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import type { MobileListingCard } from "@reswell/api-contract"
import { fetchRecentlyViewed, fetchSearchSuggest } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { readRecentSearches, rememberSearch } from "@/lib/recent-searches"
import { fontFamily, useReswellColors } from "@/theme"

export function SearchScreen({ onClose }: { onClose: (after?: () => void) => void }) {
  const colors = useReswellColors()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { session } = useAuth()
  const [query, setQuery] = useState("")
  const [recent, setRecent] = useState<string[]>([])
  const [viewed, setViewed] = useState<MobileListingCard[]>([])
  const [hits, setHits] = useState<MobileListingCard[]>([])
  const [loading, setLoading] = useState(false)
  const trimmed = query.trim()
  const searching = trimmed.length >= 2

  useEffect(() => {
    readRecentSearches().then(setRecent).catch(() => setRecent([]))
  }, [])

  useEffect(() => {
    const token = session?.access_token
    if (!token) {
      setViewed([])
      return
    }
    let cancelled = false
    fetchRecentlyViewed(token)
      .then((page) => {
        if (!cancelled) setViewed(page.listings)
      })
      .catch(() => {
        if (!cancelled) setViewed([])
      })
    return () => {
      cancelled = true
    }
  }, [session?.access_token])

  useEffect(() => {
    if (!searching) {
      setHits([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    const timer = setTimeout(() => {
      fetchSearchSuggest(trimmed)
        .then((next) => {
          if (!cancelled) setHits(next)
        })
        .catch(() => {
          if (!cancelled) setHits([])
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [searching, trimmed])

  function openListing(id: string) {
    if (trimmed.length >= 2) {
      rememberSearch(trimmed).then(setRecent).catch(() => undefined)
    }
    onClose(() => router.push({ pathname: "/listing/[id]", params: { id } }))
  }

  function openResults() {
    if (trimmed.length < 2) return
    rememberSearch(trimmed).then(setRecent).catch(() => undefined)
    onClose(() => router.push({ pathname: "/search-results", params: { q: trimmed } }))
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close search" hitSlop={8} onPress={() => onClose()}>
          <SymbolView name={{ ios: "chevron.down", android: "expand_more", web: "expand_more" }} size={22} tintColor={colors.foreground} />
        </Pressable>
        <View style={[styles.field, { borderColor: colors.border }]}>
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder="Search surfboards, fins, wetsuits or apparel…"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={openResults}
            style={[styles.input, { color: colors.foreground, fontFamily: fontFamily.text }]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={8}
            disabled={query.length === 0}
            onPress={() => setQuery("")}
            style={query.length === 0 ? styles.clearHidden : null}
          >
            <SymbolView name={{ ios: "xmark.circle.fill", android: "cancel", web: "cancel" }} size={18} tintColor={colors.muted} />
          </Pressable>
        </View>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
        {searching ? (
          <Results hits={hits} loading={loading} onOpen={openListing} onSeeAll={openResults} />
        ) : (
          <Idle
            recent={recent}
            viewed={viewed}
            onRecent={(value) => setQuery(value)}
            onOpen={(listing) => openListing(listing.slug || listing.id)}
          />
        )}
      </ScrollView>
    </View>
  )
}

function Idle({
  recent,
  viewed,
  onRecent,
  onOpen,
}: {
  recent: string[]
  viewed: MobileListingCard[]
  onRecent: (query: string) => void
  onOpen: (listing: MobileListingCard) => void
}) {
  const colors = useReswellColors()
  return (
    <View style={styles.idle}>
      {recent.length > 0 ? (
        <View style={styles.block}>
          <Text style={[styles.heading, { color: colors.foreground, fontFamily: fontFamily.headline }]}>Recent Searches</Text>
          {recent.map((item) => (
            <Pressable key={item} accessibilityRole="button" onPress={() => onRecent(item)} style={styles.recentRow}>
              <SymbolView name={{ ios: "magnifyingglass", android: "search", web: "search" }} size={18} tintColor={colors.muted} />
              <Text style={[styles.recentLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>{item}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {viewed.length > 0 ? (
        <View style={styles.block}>
          <Text style={[styles.heading, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
            Recently Viewed Listings
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.viewedRow}>
            {viewed.map((listing) => (
              <Pressable key={listing.id} accessibilityRole="button" onPress={() => onOpen(listing)}>
                {listing.image_url ? (
                  <Image source={{ uri: listing.image_url }} style={[styles.viewedImage, { backgroundColor: colors.image }]} contentFit="cover" />
                ) : (
                  <View style={[styles.viewedImage, { backgroundColor: colors.image }]} />
                )}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  )
}

function Results({
  hits,
  loading,
  onOpen,
  onSeeAll,
}: {
  hits: MobileListingCard[]
  loading: boolean
  onOpen: (id: string) => void
  onSeeAll: () => void
}) {
  const colors = useReswellColors()
  return (
    <View style={styles.block}>
      <Text style={[styles.heading, { color: colors.foreground, fontFamily: fontFamily.headline }]}>Top results</Text>
      {loading && hits.length === 0 ? <ActivityIndicator color={colors.foreground} style={styles.spinner} /> : null}
      {!loading && hits.length === 0 ? (
        <Text style={[styles.empty, { color: colors.muted, fontFamily: fontFamily.text }]}>No listings match that search.</Text>
      ) : null}
      {hits.map((hit) => {
        const place = [hit.city, hit.state].filter(Boolean).join(", ")
        const meta = [hit.brand, place].filter(Boolean).join(" · ")
        return (
          <Pressable key={hit.id} accessibilityRole="button" onPress={() => onOpen(hit.slug || hit.id)} style={styles.hit}>
            {hit.image_url ? (
              <Image source={{ uri: hit.image_url }} style={[styles.thumb, { backgroundColor: colors.image }]} contentFit="cover" />
            ) : (
              <View style={[styles.thumb, { backgroundColor: colors.image }]} />
            )}
            <View style={styles.hitCopy}>
              <Text numberOfLines={2} style={[styles.hitTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
                {hit.title}
              </Text>
              {meta ? (
                <Text numberOfLines={1} style={[styles.hitMeta, { color: colors.muted, fontFamily: fontFamily.text }]}>
                  {meta}
                </Text>
              ) : null}
              <Text style={[styles.hitPrice, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                {hit.price_label}
              </Text>
            </View>
          </Pressable>
        )
      })}
      {hits.length > 0 ? (
        <Pressable accessibilityRole="button" onPress={onSeeAll} style={styles.seeAll}>
          <Text style={[styles.seeAllLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>See all results</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  bar: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingBottom: 8 },
  field: {
    flex: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 999,
    paddingLeft: 16,
    paddingRight: 12,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: 8 },
  clearHidden: { opacity: 0 },
  body: { paddingBottom: 40 },
  idle: { gap: 28 },
  block: { gap: 4, paddingTop: 12 },
  heading: { fontSize: 18, fontWeight: "700", paddingHorizontal: 20, marginBottom: 8 },
  recentRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingVertical: 12 },
  recentLabel: { fontSize: 16 },
  viewedRow: { gap: 10, paddingHorizontal: 20 },
  viewedImage: { width: 92, height: 122, borderRadius: 10 },
  spinner: { marginTop: 24 },
  empty: { paddingHorizontal: 20, paddingVertical: 16, fontSize: 16 },
  hit: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 20, paddingVertical: 6 },
  thumb: { width: 48, height: 60, borderRadius: 6 },
  hitCopy: { flex: 1, gap: 1 },
  hitTitle: { fontSize: 14, lineHeight: 18, fontWeight: "700" },
  hitMeta: { fontSize: 12, lineHeight: 16 },
  hitPrice: { fontSize: 13, fontWeight: "700" },
  seeAll: { paddingHorizontal: 20, paddingVertical: 14 },
  seeAllLabel: { fontSize: 15, fontWeight: "600" },
})
