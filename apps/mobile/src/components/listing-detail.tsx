import { useRouter } from "expo-router"
import { SymbolView } from "expo-symbols"
import { Linking, StyleSheet, Text, View } from "react-native"
import type { MobileListingDetail } from "@reswell/api-contract"
import { ListingDeliveryCaption } from "@/components/listing-delivery-caption"
import { ListingFulfillment } from "@/components/listing-fulfillment"
import { ListingSellerPanel } from "@/components/listing-seller-panel"
import { setCartItem } from "@/lib/api"
import { useAuthGate } from "@/lib/auth-gate"
import { publicApiUrl } from "@/lib/public-env"
import { fontFamily, useReswellColors } from "@/theme"

export function ListingDetail({ listing }: { listing: MobileListingDetail }) {
  const colors = useReswellColors()
  const sold = listing.status === "sold"
  const pending = listing.status === "pending_sale"

  return (
    <View style={styles.body}>
      <Text numberOfLines={2} style={[styles.title, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
        {listing.title}
      </Text>
      <Identity brand={listing.brand} model={listing.model} brandSlug={listing.brand_slug} modelSlug={listing.model_slug} />
      {sold ? null : <Engagement listing={listing} />}
      {sold ? (
        <View style={[styles.soldBanner, { backgroundColor: colors.foreground }]}>
          <Text style={[styles.soldBannerTitle, { color: colors.primaryForeground, fontFamily: fontFamily.headline }]}>
            Sold
          </Text>
          <Text style={[styles.soldBannerPrice, { color: colors.primaryForeground, fontFamily: fontFamily.text }]}>
            Sold for {listing.price_label}
          </Text>
        </View>
      ) : (
        <View style={styles.priceRow}>
          <Text style={[styles.price, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
            {listing.price_label}
          </Text>
          {pending ? (
            <View style={[styles.status, { backgroundColor: colors.image }]}>
              <Text style={[styles.statusLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                Pending sale
              </Text>
            </View>
          ) : null}
        </View>
      )}
      {sold ? null : <ListingDeliveryCaption listing={listing} />}
      {sold ? null : <KlarnaLine listingId={listing.id} />}
      <ListingSellerPanel listing={listing} />
      <ListingFulfillment listing={listing} />
    </View>
  )
}

function Engagement({ listing }: { listing: MobileListingDetail }) {
  const colors = useReswellColors()
  const cart =
    listing.cart_holder_count === 1
      ? "In someone’s cart"
      : listing.cart_holder_count > 1
        ? `In ${listing.cart_holder_count} buyers’ carts`
        : null
  return (
    <View style={styles.engagement}>
      <Text style={[styles.engagementText, { color: colors.muted, fontFamily: fontFamily.text }]}>
        Views: <Text style={{ color: colors.foreground, fontWeight: "600" }}>{listing.view_count}</Text>
      </Text>
      <Text style={[styles.engagementText, { color: colors.muted, fontFamily: fontFamily.text }]}>
        Watchers: <Text style={{ color: colors.foreground, fontWeight: "600" }}>{listing.watcher_count}</Text>
      </Text>
      {cart ? (
        <View style={styles.cartNote}>
          <SymbolView name={{ ios: "cart", android: "shopping_cart", web: "shopping_cart" }} size={14} tintColor={colors.shipping} />
          <Text style={[styles.engagementText, { color: colors.shipping, fontFamily: fontFamily.text }]}>{cart}</Text>
        </View>
      ) : null}
    </View>
  )
}

function KlarnaLine({ listingId }: { listingId: string }) {
  const colors = useReswellColors()
  const router = useRouter()
  const { requestAuth } = useAuthGate()
  return (
    <Text style={[styles.klarna, { color: colors.foreground, fontFamily: fontFamily.text }]}>
      As low as monthly payments with{" "}
      <Text
        style={styles.link}
        onPress={() => {
          requestAuth((token) => {
            void setCartItem(token, listingId, 1)
              .then(() => router.push("/account/cart"))
              .catch(() => router.push("/account/cart"))
          })
        }}
      >
        Klarna
      </Text>
      .{" "}
      <Text style={styles.link} onPress={() => void Linking.openURL(`${publicApiUrl()}/help/buying/how-do-i-pay`)}>
        Learn more
      </Text>
    </Text>
  )
}

function Identity({
  brand,
  model,
  brandSlug,
  modelSlug,
}: {
  brand: string | null
  model: string | null
  brandSlug: string | null
  modelSlug: string | null
}) {
  const colors = useReswellColors()
  const router = useRouter()
  const name = brand?.trim() || null
  const shape = model?.trim() || null
  if (!name && !shape) return null
  return (
    <Text style={[styles.identity, { color: colors.foreground, fontFamily: fontFamily.text }]}>
      {name ? (
        <Text
          style={brandSlug ? styles.identityStrong : undefined}
          onPress={
            brandSlug
              ? () => router.push({ pathname: "/brands/[slug]", params: { slug: brandSlug } })
              : undefined
          }
        >
          {name}
        </Text>
      ) : null}
      {name && shape ? <Text style={{ color: colors.border }}> · </Text> : null}
      {shape ? (
        <Text
          style={brandSlug && modelSlug ? styles.identityStrong : undefined}
          onPress={
            brandSlug && modelSlug
              ? () => router.push({ pathname: "/brands/[slug]/[model]", params: { slug: brandSlug, model: modelSlug } })
              : undefined
          }
        >
          {shape}
        </Text>
      ) : null}
    </Text>
  )
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28 },
  title: { fontSize: 22, fontWeight: "700", letterSpacing: -0.44, lineHeight: 28 },
  identity: { marginTop: 6, fontSize: 15, lineHeight: 20 },
  identityStrong: { fontWeight: "700", textDecorationLine: "underline" },
  engagement: { marginTop: 10, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12 },
  engagementText: { fontSize: 14 },
  cartNote: { flexDirection: "row", alignItems: "center", gap: 4 },
  priceRow: { marginTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  price: { fontSize: 30, fontWeight: "700", letterSpacing: -0.6, lineHeight: 34 },
  soldBanner: { marginTop: 16, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, gap: 2 },
  soldBannerTitle: { fontSize: 22, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase" },
  soldBannerPrice: { fontSize: 16, fontWeight: "600" },
  status: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusLabel: { fontSize: 13, fontWeight: "600" },
  klarna: { marginTop: 8, fontSize: 14, lineHeight: 20 },
  link: { fontWeight: "700", textDecorationLine: "underline" },
})
