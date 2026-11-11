import { Stack, useFocusEffect, useRouter } from "expo-router"
import { useCallback, useRef, useState } from "react"
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import type { MobileBrowseRail, MobileHome, MobileListingCard, MobileListingCategory } from "@reswell/api-contract"
import { CategorySlider } from "@/components/browse-chips"
import { useFloatingTabBarContentInset } from "@/components/floating-tab-bar"
import { HomeFeed } from "@/components/home-feed"
import { HomeHeader } from "@/components/home-header"
import { fetchBrowseRail, fetchHome, prefetchListing } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import {
  getRecentlyViewedCached,
  hydrateRecentlyViewedCache,
  refreshRecentlyViewed,
} from "@/lib/recently-viewed-cache"
import { peekBrowseRail, peekHome } from "@/lib/marketplace-screen-cache"
import { useAuthGate } from "@/lib/auth-gate"
import { fontFamily, useReswellColors } from "@/theme"

export default function ListingsScreen() {
  const colors = useReswellColors()
  const router = useRouter()
  const { session } = useAuth()
  const { requestAuth } = useAuthGate()
  const accessToken = session?.access_token ?? null
  const userId = session?.user?.id ?? null
  const [home, setHome] = useState<MobileHome | null>(() => peekHome())
  const [continueListings, setContinueListings] = useState<MobileListingCard[]>(() =>
    getRecentlyViewedCached(userId),
  )
  const [rail, setRail] = useState<MobileBrowseRail | null>(() => peekBrowseRail())
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(() => !peekHome())
  const [refreshing, setRefreshing] = useState(false)
  const tabBarInset = useFloatingTabBarContentInset()
  const homeRef = useRef(home)
  homeRef.current = home

  const load = useCallback(
    (mode: "focus" | "pull" = "focus") => {
      let cancelled = false
      const force = mode === "pull"
      if (mode === "pull") setRefreshing(true)
      if (!peekHome() && !homeRef.current) setLoading(true)
      fetchBrowseRail({ force })
        .then((next) => {
          if (!cancelled) setRail(next)
        })
        .catch(() => undefined)
      if (userId) {
        void hydrateRecentlyViewedCache(userId).then((listings) => {
          if (!cancelled && listings.length > 0) setContinueListings(listings)
        })
      } else {
        setContinueListings([])
      }
      if (accessToken && userId) {
        refreshRecentlyViewed(accessToken, userId)
          .then((viewedListings) => {
            if (!cancelled) setContinueListings(viewedListings)
          })
          .catch(() => {
            if (!cancelled) setContinueListings(getRecentlyViewedCached(userId))
          })
      }
      fetchHome({ force })
        .then((next) => {
          if (!cancelled) {
            setHome(next)
            setError(null)
          }
        })
        .catch((cause: unknown) => {
          if (cancelled) return
          if (peekHome() || homeRef.current) return
          setHome(null)
          setError(cause instanceof Error ? cause.message : "Unable to load the homepage")
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false)
            if (mode === "pull") setRefreshing(false)
          }
        })
      return () => {
        cancelled = true
      }
    },
    [accessToken, userId],
  )

  useFocusEffect(
    useCallback(() => {
      return load("focus")
    }, [load]),
  )

  function openListing(id: string) {
    prefetchListing(id, accessToken)
    router.push({ pathname: "/listing/[id]", params: { id } })
  }

  function openCategory(category: MobileListingCategory) {
    router.push({ pathname: "/category/[slug]", params: { slug: category } })
  }

  function openResource(screen: string) {
    router.push({ pathname: "/seller-resources/[slug]", params: { slug: screen } })
  }

  function openPage(page: "sellers" | "sold") {
    if (page === "sellers") {
      router.push("/sellers")
      return
    }
    router.push({ pathname: "/feed", params: { tab: "sold" } })
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <HomeHeader
        onCart={() => requestAuth(() => router.push("/account/cart"))}
        onInbox={() => requestAuth(() => router.push("/inbox"))}
      />
      {loading && !home ? (
        <ScrollView contentContainerStyle={tabBarInset}>
          <CategorySlider items={rail?.items ?? null} onOpenCategory={openCategory} onOpenResource={openResource} onOpenPage={openPage} />
          <ActivityIndicator style={styles.centered} color={colors.foreground} />
        </ScrollView>
      ) : error && !home ? (
        <ScrollView contentContainerStyle={tabBarInset}>
          <CategorySlider items={rail?.items ?? null} onOpenCategory={openCategory} onOpenResource={openResource} onOpenPage={openPage} />
          <View style={styles.centered}>
            <Text style={{ color: colors.foreground, fontFamily: fontFamily.text }}>{error}</Text>
            <Pressable onPress={() => { load() }}>
              <Text style={[styles.headerAction, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                Try again
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      ) : (
        <HomeFeed
          sections={home?.sections ?? []}
          continueListings={continueListings}
          refreshing={refreshing}
          onRefresh={() => {
            load("pull")
          }}
          onOpenListing={(listing) => openListing(listing.slug || listing.id)}
          onOpenShop={(slug) => router.push({ pathname: "/profile/[slug]", params: { slug } })}
          onOpenBrand={(slug) => router.push({ pathname: "/brands/[slug]", params: { slug } })}
          onOpenDirectory={() => router.push("/brands")}
          onOpenCategory={openCategory}
          onOpenResource={openResource}
          onOpenPage={openPage}
          rail={rail?.items ?? null}
          viewerId={session?.user?.id ?? null}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  headerAction: { fontSize: 16, fontWeight: "600" },
})
