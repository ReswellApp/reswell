import { Image } from "expo-image"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { RefreshControl } from "react-native-gesture-handler"
import type { MobileBrowseRailItem, MobileHomeSection, MobileListingCard, MobileListingCategory } from "@reswell/api-contract"
import { CategorySlider } from "@/components/browse-chips"
import { HorizontalRail, VerticalScroll } from "@/components/horizontal-rail"
import { ListingCard } from "@/components/listing-card"
import { fontFamily, useReswellColors } from "@/theme"

export function HomeFeed({
  sections,
  continueListings,
  refreshing,
  onRefresh,
  onOpenListing,
  onOpenShop,
  onOpenCategory,
  onOpenResource,
  onOpenPage,
  rail,
}: {
  sections: MobileHomeSection[]
  continueListings: MobileListingCard[]
  refreshing: boolean
  onRefresh: () => void
  onOpenListing: (listing: MobileListingCard) => void
  onOpenShop: (slug: string) => void
  onOpenCategory: (category: MobileListingCategory) => void
  onOpenResource: (screen: string) => void
  onOpenPage: (page: "sellers" | "sold") => void
  rail: MobileBrowseRailItem[] | null
}) {
  const colors = useReswellColors()
  return (
    <VerticalScroll
      style={styles.feed}
      contentContainerStyle={styles.page}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.foreground} />}
    >
      <CategorySlider items={rail} onOpenCategory={onOpenCategory} onOpenResource={onOpenResource} onOpenPage={onOpenPage} />
      {continueListings.length > 0 ? (
        <ListingSection title="Pick up where you left off" listings={continueListings} onOpenListing={onOpenListing} />
      ) : null}
      {sections.map((section) =>
        section.kind === "listings" ? (
          <ListingSection
            key={section.id}
            title={section.title}
            listings={section.listings}
            badge={section.id === "recently_sold" ? "Sold" : undefined}
            onOpenListing={onOpenListing}
          />
        ) : section.kind === "brands" ? (
          <View key={section.id} style={styles.section}>
            <SectionTitle title={section.title} />
            <HorizontalRail contentStyle={styles.rail}>
              {section.brands.map((brand) => (
                <BrandMark key={brand.id} name={brand.name} logoUrl={brand.logo_url} />
              ))}
            </HorizontalRail>
          </View>
        ) : (
          <View key={section.id} style={styles.section}>
            <SectionTitle title={section.title} />
            <HorizontalRail contentStyle={styles.rail}>
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
            </HorizontalRail>
          </View>
        ),
      )}
    </VerticalScroll>
  )
}

function ListingSection({
  title,
  listings,
  badge,
  onOpenListing,
}: {
  title: string
  listings: MobileListingCard[]
  badge?: string
  onOpenListing: (listing: MobileListingCard) => void
}) {
  return (
    <View style={styles.section}>
      <SectionTitle title={title} />
      <HorizontalRail contentStyle={styles.rail}>
        {listings.map((listing) => (
          <View key={listing.id} style={styles.railCard}>
            <ListingCard item={listing} badge={badge} onPress={() => onOpenListing(listing)} />
          </View>
        ))}
      </HorizontalRail>
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
