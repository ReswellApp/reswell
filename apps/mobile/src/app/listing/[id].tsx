import { Stack, useLocalSearchParams, useRouter } from "expo-router"
import { useEffect, useState } from "react"
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native"
import type { MobileListingDetail, MobileListingRailSection } from "@reswell/api-contract"
import { ScreenSearchHeader } from "@/components/screen-search-header"
import { ListingActions } from "@/components/listing-actions"
import { ListingDetail } from "@/components/listing-detail"
import { ListingGallery } from "@/components/listing-gallery"
import { ScreenFooter, ScreenScroll, ScreenShell } from "@/components/screen-shell"
import { ListingRails } from "@/components/listing-rails"
import { fetchListing, fetchListingRails } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { fontFamily, useReswellColors } from "@/theme"

export default function ListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const colors = useReswellColors()
  const router = useRouter()
  const { session } = useAuth()
  const token = session?.access_token
  const [listing, setListing] = useState<MobileListingDetail | null>(null)
  const [rails, setRails] = useState<MobileListingRailSection[]>([])
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setError(null)
    setRails([])
    fetchListing(id, token)
      .then((next) => {
        if (!cancelled) setListing(next)
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load listing")
      })
    fetchListingRails(id, token)
      .then((next) => {
        if (!cancelled) setRails(next.sections)
      })
      .catch(() => {
        if (!cancelled) setRails([])
      })
    return () => {
      cancelled = true
    }
  }, [id, token, attempt])

  return (
    <ScreenShell style={{ backgroundColor: colors.background }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenSearchHeader showBack />
      {!listing && !error ? (
        <ActivityIndicator style={styles.centered} color={colors.foreground} />
      ) : error || !listing ? (
        <View style={styles.centered}>
          <Text style={[styles.error, { color: colors.foreground, fontFamily: fontFamily.text }]}>
            {error ?? "Unable to load listing"}
          </Text>
          <Pressable onPress={() => setAttempt((current) => current + 1)}>
            <Text style={[styles.retry, { color: colors.foreground, fontFamily: fontFamily.text }]}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <ScreenScroll
            reserveFooter={listing.status !== "sold"}
            contentInsetAdjustmentBehavior="never"
          >
            <ListingGallery
              urls={listing.image_urls}
              video={
                listing.videos[0]
                  ? { url: listing.videos[0].url, posterUrl: listing.videos[0].poster_url }
                  : null
              }
              sold={listing.status === "sold"}
              dimensionsLine={listingDimensionsLine(listing.dimensions, listing.volume_label)}
            />
            <ListingDetail listing={listing} />
            <ListingRails
              sections={rails}
              onOpenListing={(item) =>
                router.push({ pathname: "/listing/[id]", params: { id: item.slug || item.id } })
              }
            />
          </ScreenScroll>
          {listing.status === "sold" ? null : (
            <ScreenFooter bordered={false}>
              <ListingActions listing={listing} onChange={setListing} />
            </ScreenFooter>
          )}
        </>
      )}
    </ScreenShell>
  )
}

/** Same caption the website prints in the enlarge view. */
function listingDimensionsLine(dimensions: string | null, volume: string | null): string | null {
  if (dimensions && volume) return `${dimensions} · ${volume}`
  return dimensions ?? volume
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  error: { textAlign: "center", fontSize: 16 },
  retry: { fontSize: 16, fontWeight: "600" },
})
