import { Image } from "expo-image"
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native"
import type { MobileHomeSection, MobileListingCard } from "@reswell/api-contract"
import { ListingCard } from "@/components/listing-card"
import { fontFamily, useReswellColors } from "@/theme"

export function HomeFeed({
  sections,
  continueListings,
  refreshing,
  onRefresh,
  onOpenListing,
  onOpenShop,
}: {
  sections: MobileHomeSection[]
  continueListings: MobileListingCard[]
  refreshing: boolean
  onRefresh: () => void
  onOpenListing: (listing: MobileListingCard) => void
  onOpenShop: (slug: string) => void
}) {
  const colors = useReswellColors()
  return (
    <ScrollView
      style={styles.feed}
      contentContainerStyle={styles.page}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.foreground} />}
    >
      {continueListings.length > 0 ? (
        <ListingSection
          title="Pick up where you left off"
          listings={continueListings}
          onOpenListing={onOpenListing}
        />
      ) : null}
      {sections.map((section) =>
        section.kind === "listings" ? (
          <ListingSection
            key={section.id}
            title={section.title}
            listings={section.listings}
            onOpenListing={onOpenListing}
          />
        ) : section.kind === "brands" ? (
          <View key={section.id} style={styles.section}>
            <SectionTitle title={section.title} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
              {section.brands.map((brand) => (
                <BrandMark key={brand.id} name={brand.name} logoUrl={brand.logo_url} />
              ))}
            </ScrollView>
          </View>
        ) : (
          <View key={section.id} style={styles.section}>
            <SectionTitle title={section.title} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
              {section.shops.map((shop) => {
                const slug = shop.seller_slug
                return (
                  <ShopMark
                    key={shop.id}
                    name={shop.name}
                    location={shop.location_label}
                    avatarUrl={shop.avatar_url}
                    onPress={slug ? () => onOpenShop(slug) : undefined}
                  />
                )
              })}
            </ScrollView>
          </View>
        ),
      )}
    </ScrollView>
  )
}

function ListingSection({
  title,
  listings,
  onOpenListing,
}: {
  title: string
  listings: MobileListingCard[]
  onOpenListing: (listing: MobileListingCard) => void
}) {
  return (
    <View style={styles.section}>
      <SectionTitle title={title} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
        {listings.map((listing) => (
          <View key={listing.id} style={styles.railCard}>
            <ListingCard item={listing} onPress={() => onOpenListing(listing)} />
          </View>
        ))}
      </ScrollView>
    </View>
  )
}

function SectionTitle({ title }: { title: string }) {
  const colors = useReswellColors()
  return (
    <Text style={[styles.title, { color: colors.foreground, fontFamily: fontFamily.headline }]}>{title}</Text>
  )
}

function BrandMark({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  const colors = useReswellColors()
  return (
    <View style={styles.brand}>
      {logoUrl ? (
        <Image source={{ uri: logoUrl }} style={[styles.logo, { backgroundColor: colors.image }]} contentFit="contain" />
      ) : (
        <View style={[styles.logo, { backgroundColor: colors.image }]} />
      )}
      <Text numberOfLines={1} style={[styles.brandName, { color: colors.foreground, fontFamily: fontFamily.text }]}>
        {name}
      </Text>
    </View>
  )
}

function ShopMark({
  name,
  location,
  avatarUrl,
  onPress,
}: {
  name: string
  location: string | null
  avatarUrl: string | null
  onPress?: () => void
}) {
  const colors = useReswellColors()
  const body = (
    <View style={styles.shop}>
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={[styles.avatar, { backgroundColor: colors.image }]} />
      ) : (
        <View style={[styles.avatar, { backgroundColor: colors.image }]} />
      )}
      <Text numberOfLines={1} style={[styles.brandName, { color: colors.foreground, fontFamily: fontFamily.text }]}>
        {name}
      </Text>
      {location ? (
        <Text numberOfLines={1} style={[styles.location, { color: colors.muted, fontFamily: fontFamily.text }]}>
          {location}
        </Text>
      ) : null}
    </View>
  )
  if (!onPress) return body
  return <Pressable onPress={onPress}>{body}</Pressable>
}

const styles = StyleSheet.create({
  feed: { flex: 1 },
  page: { paddingBottom: 120 },
  section: { marginTop: 20 },
  title: { fontSize: 22, fontWeight: "700", letterSpacing: -0.4, paddingHorizontal: 16, marginBottom: 12 },
  rail: { paddingHorizontal: 16, gap: 12 },
  railCard: { width: 168 },
  brand: { width: 88, alignItems: "center", gap: 6 },
  logo: { width: 72, height: 72, borderRadius: 36 },
  brandName: { fontSize: 13, fontWeight: "600", textAlign: "center" },
  shop: { width: 120, alignItems: "center", gap: 4 },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  location: { fontSize: 12, textAlign: "center" },
})
