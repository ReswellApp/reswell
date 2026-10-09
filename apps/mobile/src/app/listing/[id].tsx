import { Stack, useLocalSearchParams, useRouter } from "expo-router"
import { SymbolView } from "expo-symbols"
import { useEffect, useState } from "react"
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import type { MobileListingDetail } from "@reswell/api-contract"
import { ListingActions } from "@/components/listing-actions"
import { ListingDetail } from "@/components/listing-detail"
import { ListingGallery } from "@/components/listing-gallery"
import { fetchListing } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { fontFamily, useReswellColors } from "@/theme"

export default function ListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const colors = useReswellColors()
  const router = useRouter()
  const { session } = useAuth()
  const token = session?.access_token
  const [listing, setListing] = useState<MobileListingDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setError(null)
    fetchListing(id, token)
      .then((next) => {
        if (!cancelled) setListing(next)
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load listing")
      })
    return () => {
      cancelled = true
    }
  }, [id, token, attempt])

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: "",
          headerTransparent: true,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: "transparent" },
          headerLeft: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={() => router.back()}
              style={[styles.back, { backgroundColor: colors.background }]}
            >
              <SymbolView
                name={{ ios: "chevron.left", android: "arrow_back", web: "arrow_back" }}
                size={18}
                tintColor={colors.foreground}
              />
            </Pressable>
          ),
        }}
      />
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
          <ScrollView contentInsetAdjustmentBehavior="never">
            <ListingGallery urls={listing.image_urls} />
            <ListingDetail listing={listing} />
          </ScrollView>
          <ListingActions listing={listing} onChange={setListing} />
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  back: {
    width: 36,
    height: 36,
    marginLeft: 8,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  error: { textAlign: "center", fontSize: 16 },
  retry: { fontSize: 16, fontWeight: "600" },
})
