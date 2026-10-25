import { Pressable, StyleSheet, Text, View } from "react-native"
import { RefreshControl } from "react-native-gesture-handler"
import type { MobileBrowseRailItem, MobileHomeSection, MobileListingCard, MobileListingCategory } from "@reswell/api-contract"
import { CategorySlider } from "@/components/browse-chips"
import { HorizontalRail, VerticalScroll } from "@/components/horizontal-rail"
import { ListingCard } from "@/components/listing-card"
import { ProfileCircle } from "@/components/profile-circle"
import { fontFamily, useReswellColors } from "@/theme"

export function HomeFeed({
  sections,
  continueListings,
  refreshing,
  onRefresh,
  onOpenListing,
  onOpenShop,
  onOpenBrand,
  onOpenDirectory,
  onOpenCategory,
  onOpenResource,
  onOpenPage,
  rail,
  viewerId,
}: {
  sections: MobileHomeSection[]
  continueListings: MobileListingCard[]
  refreshing: boolean
  onRefresh: () => void
  viewerId?: string | null
  onOpenListing: (listing: MobileListingCard) => void
  onOpenShop: (slug: string) => void
  onOpenBrand: (slug: string) => void
  onOpenDirectory: () => void
  onOpenCategory: (category: MobileListingCategory) => void
  onOpenResource: (screen: string) => void
  onOpenPage: (page: "sellers" | "sold") => void
  rail: MobileBrowseRailItem[] | null
}) {
  const colors = useReswellColors()
  return (
    <VerticalScroll
      style={styles.feed}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.foreground} />}
    >
      <CategorySlider items={rail} onOpenCategory={onOpenCategory} onOpenResource={onOpenResource} onOpenPage={onOpenPage} />
      {continueListings.length > 0 ? (
        <ListingSection
          title="Pick up where you left off"
          listings={continueListings}
          viewerId={viewerId}
          onOpenListing={onOpenListing}
        />
      ) : null}
      {sections.map((section) =>
        section.kind === "listings" ? (
          <ListingSection
            key={section.id}
            title={section.title}
            listings={section.listings}
            badge={section.id === "recently_sold" ? "Sold" : undefined}
            viewerId={viewerId}
            onOpenListing={onOpenListing}
          />
        ) : section.kind === "brands" ? (
          <View key={section.id} style={styles.section}>
            <SectionTitle title={section.title} />
            <Pressable onPress={onOpenDirectory} style={styles.directory}>
              <Text style={[styles.directoryLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>All brands</Text>
            </Pressable>
            <HorizontalRail contentStyle={styles.rail}>
              {section.brands.map((brand) => (
                <BrandMark key={brand.id} name={brand.name} onPress={() => onOpenBrand(brand.slug)} />
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
  viewerId,
  onOpenListing,
}: {
  title: string
  listings: MobileListingCard[]
  badge?: string
  viewerId?: string | null
  onOpenListing: (listing: MobileListingCard) => void
}) {
  return (
    <View style={styles.section}>
      <SectionTitle title={title} />
      <HorizontalRail contentStyle={styles.rail}>
        {listings.map((listing) => (
          <View key={listing.id} style={styles.railCard}>
            <ListingCard
              item={listing}
              badge={badge}
              viewerId={viewerId}
              onPress={() => onOpenListing(listing)}
            />
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

function BrandMark({ name, onPress }: { name: string; onPress: () => void }) {
  const colors = useReswellColors()
  const initial = name.trim().charAt(0).toUpperCase() || "?"
  return (
    <Pressable onPress={onPress} style={styles.brand}>
      <View style={[styles.logo, { backgroundColor: colors.image }]}>
        <Text style={[styles.logoInitial, { color: colors.foreground, fontFamily: fontFamily.headline }]}>{initial}</Text>
      </View>
      <Text numberOfLines={1} style={[styles.brandName, { color: colors.foreground, fontFamily: fontFamily.text }]}>
        {name}
      </Text>
    </Pressable>
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
      <ProfileCircle url={avatarUrl} size={72} />
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
  section: { marginTop: 20 },
  title: { fontSize: 22, fontWeight: "700", letterSpacing: -0.4, paddingHorizontal: 16, marginBottom: 12 },
  directory: { paddingHorizontal: 16, marginTop: -6, marginBottom: 10 },
  directoryLabel: { fontSize: 14, fontWeight: "700", textDecorationLine: "underline" },
  rail: { paddingHorizontal: 16, gap: 12 },
  railCard: { width: 168 },
  brand: { width: 88, alignItems: "center", gap: 6 },
  logo: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  logoInitial: { fontSize: 28, fontWeight: "700" },
  brandName: { fontSize: 13, fontWeight: "600", textAlign: "center" },
  shop: { width: 120, alignItems: "center", gap: 4 },
  location: { fontSize: 12, textAlign: "center" },
})
