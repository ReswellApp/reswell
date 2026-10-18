import { useRouter } from "expo-router"
import { useEffect, useState } from "react"
import { ActivityIndicator, FlatList, StyleSheet, Text } from "react-native"
import type { MobileListingCard } from "@reswell/api-contract"
import { DashboardPageGate } from "@/components/dashboard-page-gate"
import { ListingCard } from "@/components/listing-card"
import { fetchProfileListings } from "@/lib/api"
import { fontFamily, useReswellColors } from "@/theme"

export default function AccountListingsScreen() {
  return (
    <DashboardPageGate id="listings" title="My Listings">
      {(dashboard) => <Listings slug={dashboard.seller_slug} />}
    </DashboardPageGate>
  )
}

function Listings({ slug }: { slug: string | null }) {
  const colors = useReswellColors()
  const router = useRouter()
  const [listings, setListings] = useState<MobileListingCard[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) {
      setListings([])
      return
    }
    let cancelled = false
    fetchProfileListings(slug)
      .then((page) => {
        if (!cancelled) setListings(page.listings)
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load listings")
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  if (error) {
    return <Text style={[styles.message, { color: colors.foreground, fontFamily: fontFamily.text }]}>{error}</Text>
  }
  if (!listings) return <ActivityIndicator color={colors.foreground} style={styles.message} />
  if (!slug || listings.length === 0) {
    return <Text style={[styles.message, { color: colors.muted, fontFamily: fontFamily.text }]}>No active listings.</Text>
  }

  return (
    <FlatList
      data={listings}
      keyExtractor={(item) => item.id}
      numColumns={2}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <ListingCard
          item={item}
          onPress={() => router.push({ pathname: "/listing/[id]", params: { id: item.slug || item.id } })}
        />
      )}
    />
  )
}

const styles = StyleSheet.create({
  list: { paddingBottom: 120 },
  row: { gap: 12, paddingHorizontal: 12, paddingTop: 16 },
  message: { textAlign: "center", marginTop: 32, paddingHorizontal: 24, fontSize: 16 },
})
