import { Image } from "expo-image"
import { Stack, useLocalSearchParams } from "expo-router"
import { SymbolView } from "expo-symbols"
import { useEffect, useState } from "react"
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native"
import type { MobileListingDetail } from "@reswell/api-contract"
import { fetchListing } from "@/lib/api"
import { fontFamily, useReswellColors } from "@/theme"

const width = Dimensions.get("window").width

export default function ListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const colors = useReswellColors()
  const [listing, setListing] = useState<MobileListingDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    fetchListing(id)
      .then((next) => {
        if (!cancelled) setListing(next)
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load listing")
      })
    return () => {
      cancelled = true
    }
  }, [id])

  const identity = listing ? [listing.brand, listing.model].filter(Boolean).join(" · ") : ""

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: listing?.title ?? "Listing" }} />
      {!listing && !error ? (
        <ActivityIndicator style={styles.centered} color={colors.foreground} />
      ) : error || !listing ? (
        <Text style={[styles.error, { color: colors.foreground, fontFamily: fontFamily.text }]}>
          {error ?? "Unable to load listing"}
        </Text>
      ) : (
        <ScrollView contentInsetAdjustmentBehavior="automatic">
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
            {(listing.image_urls.length > 0 ? listing.image_urls : [null]).map((uri, index) =>
              uri ? (
                <Image
                  key={uri}
                  source={{ uri }}
                  style={[styles.hero, { backgroundColor: colors.image }]}
                  contentFit="cover"
                />
              ) : (
                <View key={index} style={[styles.hero, { backgroundColor: colors.image }]} />
              ),
            )}
          </ScrollView>
          <View style={styles.body}>
            <Text style={[styles.title, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
              {listing.title}
            </Text>
            {identity ? (
              <Text style={[styles.identity, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                {identity}
              </Text>
            ) : null}
            <Text style={[styles.price, { color: colors.foreground, fontFamily: fontFamily.text }]}>
              {listing.price_label}
            </Text>
            {listing.shipping_label ? (
              <Text style={[styles.shipping, { color: colors.shipping, fontFamily: fontFamily.text }]}>
                {listing.shipping_label}
              </Text>
            ) : null}
            {listing.pickup_label ? (
              <View style={styles.placeRow}>
                <SymbolView name="mappin" size={14} tintColor={colors.muted} />
                <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>
                  {listing.pickup_label}
                </Text>
              </View>
            ) : null}
            {listing.dimensions ? (
              <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>
                {listing.dimensions}
              </Text>
            ) : null}
            {listing.condition_line ? (
              <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>
                {listing.condition_line}
              </Text>
            ) : null}
            <Text style={[styles.seller, { color: colors.muted, fontFamily: fontFamily.text }]}>
              {listing.seller.name}
            </Text>
            {listing.description ? (
              <Text style={[styles.description, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                {listing.description}
              </Text>
            ) : null}
          </View>
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { marginTop: 48 },
  error: { textAlign: "center", marginTop: 48, paddingHorizontal: 24 },
  hero: { width, aspectRatio: 3 / 4 },
  body: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40, gap: 6 },
  title: { fontSize: 28, fontWeight: "700", letterSpacing: -0.6, lineHeight: 32 },
  identity: { fontSize: 15, fontWeight: "600" },
  price: { marginTop: 8, fontSize: 32, fontWeight: "700", letterSpacing: -0.5 },
  shipping: { fontSize: 15, fontWeight: "500" },
  placeRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  meta: { fontSize: 15 },
  seller: { marginTop: 8, fontSize: 15 },
  description: { marginTop: 12, fontSize: 16, lineHeight: 24 },
})
