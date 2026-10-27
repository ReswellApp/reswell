import { StyleSheet, Text, View } from "react-native"
import type { MobileListingCard, MobileListingRailSection } from "@reswell/api-contract"
import { HorizontalRail, SCREEN_GUTTER } from "@/components/horizontal-rail"
import { ListingCard } from "@/components/listing-card"
import { fontFamily, useReswellColors } from "@/theme"

/** Horizontal rails returned by the listing recommendations API. Titles stay server-owned. */
export function ListingRails({
  sections,
  onOpenListing,
}: {
  sections: MobileListingRailSection[]
  onOpenListing: (listing: MobileListingCard) => void
}) {
  const colors = useReswellColors()
  if (sections.length === 0) return null
  return (
    <View style={styles.wrap}>
      {sections.map((section) => (
        <View key={section.id} style={styles.section}>
          <Text style={[styles.title, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
            {section.title}
          </Text>
          <HorizontalRail>
            {section.listings.map((listing) => (
              <View key={listing.id} style={styles.card}>
                <ListingCard item={listing} onPress={() => onOpenListing(listing)} />
              </View>
            ))}
          </HorizontalRail>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { paddingBottom: 24 },
  section: { marginTop: 28 },
  title: { fontSize: 22, fontWeight: "700", letterSpacing: -0.4, paddingHorizontal: SCREEN_GUTTER, marginBottom: 12 },
  card: { width: 168 },
})
