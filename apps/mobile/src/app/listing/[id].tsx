import { Stack, useLocalSearchParams, useRouter } from "expo-router"
import { useCallback, useEffect, useState } from "react"
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native"
import type { MobileListingDetail, MobileListingRailSection } from "@reswell/api-contract"
import { ScreenSearchHeader } from "@/components/screen-search-header"
import { ListingActions } from "@/components/listing-actions"
import { ListingOwnerActions } from "@/components/listing-owner-actions"
import { ListingDetail } from "@/components/listing-detail"
import { ListingGallery } from "@/components/listing-gallery"
import { ScreenFooter, ScreenScroll, ScreenShell } from "@/components/screen-shell"
import { ListingRails } from "@/components/listing-rails"
import { fetchListing, fetchListingRails } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import {
  listingMatchesParam,
  peekCachedListing,
  peekCachedRails,
  rememberCachedListing,
} from "@/lib/listing-pdp-cache"
import { fontFamily, useReswellColors } from "@/theme"

export default function ListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const colors = useReswellColors()
  const router = useRouter()
  const { session } = useAuth()
  const token = session?.access_token
  const [listing, setListing] = useState<MobileListingDetail | null>(() =>
    id ? peekCachedListing(id, token) : null,
  )
  const [rails, setRails] = useState<MobileListingRailSection[]>(
    () => (id ? peekCachedRails(id, token)?.sections ?? [] : []),
  )
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const applyListing = useCallback(
    (next: MobileListingDetail) => {
      rememberCachedListing(next, token)
      setListing(next)
    },
    [token],
  )

  useEffect(() => {
    if (!id) return
    let cancelled = false
    const cachedListing = peekCachedListing(id, token)
    const cachedRails = peekCachedRails(id, token)
    setError(null)
    setListing((current) => cachedListing ?? (current && listingMatchesParam(current, id) ? current : null))
    setRails(cachedRails?.sections ?? [])
    fetchListing(id, token, { force: attempt > 0 })
      .then((next) => {
        if (!cancelled) applyListing(next)
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        const cached = peekCachedListing(id, token)
        if (cached) {
          applyListing(cached)
          return
        }
        setError(cause instanceof Error ? cause.message : "Unable to load listing")
      })
    fetchListingRails(id, token, { force: attempt > 0 })
      .then((next) => {
        if (!cancelled) setRails(next.sections)
      })
      .catch(() => {
        if (!cancelled && !peekCachedRails(id, token)) setRails([])
      })
    return () => {
      cancelled = true
    }
  }, [applyListing, id, token, attempt])

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
            reserveFooter={listing.status !== "sold" && !listing.owner}
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
              favorite={
                listing.owner
                  ? null
                  : {
                      listingId: listing.id,
                      favorited: listing.favorited,
                      onFavoritedChange: (favorited) =>
                        setListing((current) => {
                          if (!current) return current
                          const next = {
                            ...current,
                            favorited,
                            watcher_count: Math.max(
                              0,
                              current.watcher_count +
                                (favorited === Boolean(current.favorited) ? 0 : favorited ? 1 : -1),
                            ),
                          }
                          rememberCachedListing(next, token)
                          return next
                        }),
                    }
              }
            />
            {listing.status !== "sold" && listing.owner ? (
              <ListingOwnerActions listing={listing} onChange={applyListing} />
            ) : null}
            <ListingDetail listing={listing} />
            <ListingRails
              sections={rails}
              onOpenListing={(item) =>
                router.push({ pathname: "/listing/[id]", params: { id: item.slug || item.id } })
              }
            />
          </ScreenScroll>
          {listing.status === "sold" || listing.owner ? null : (
            <ScreenFooter bordered={false}>
              <ListingActions listing={listing} onChange={applyListing} />
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
