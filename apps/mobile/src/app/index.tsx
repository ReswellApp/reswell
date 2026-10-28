import { Stack, useFocusEffect, useRouter } from "expo-router"
import { useCallback, useState } from "react"
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import type { MobileBrowseRail, MobileHome, MobileListingCard, MobileListingCategory } from "@reswell/api-contract"
import { CategorySlider } from "@/components/browse-chips"
import { useFloatingTabBarContentInset } from "@/components/floating-tab-bar"
import { HomeFeed } from "@/components/home-feed"
import { HomeHeader } from "@/components/home-header"
import { fetchBrowseRail, fetchHome } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { getRecentlyViewedCached, refreshRecentlyViewed } from "@/lib/recently-viewed-cache"
import { useAuthGate } from "@/lib/auth-gate"
import { fontFamily, useReswellColors } from "@/theme"

export default function ListingsScreen() {
  const colors = useReswellColors()
  const router = useRouter()
  const { session } = useAuth()
  const { requestAuth } = useAuthGate()
  const accessToken = session?.access_token ?? null
  const userId = session?.user?.id ?? null
  const [home, setHome] = useState<MobileHome | null>(null)
  const [continueListings, setContinueListings] = useState<MobileListingCard[]>([])
  const [rail, setRail] = useState<MobileBrowseRail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const tabBarInset = useFloatingTabBarContentInset()

  const load = useCallback((mode: "focus" | "pull" = "focus") => {
    let cancelled = false
    if (mode === "pull") setRefreshing(true)
    setLoading(true)
    fetchBrowseRail()
      .then((next) => {
        if (!cancelled) setRail(next)
      })
      .catch(() => undefined)
    const recent =
      accessToken && userId
        ? refreshRecentlyViewed(accessToken, userId).catch(() => getRecentlyViewedCached(userId))
        : Promise.resolve([])
    Promise.all([fetchHome(), recent])
      .then(([next, viewedListings]) => {
        if (!cancelled) {
          setHome(next)
          setContinueListings(viewedListings)
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
        if (!cancelled) {
          setLoading(false)
          if (mode === "pull") setRefreshing(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [accessToken, userId])

  useFocusEffect(load)

  function openListing(id: string) {
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
