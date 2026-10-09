import { Link } from "expo-router"
import { SymbolView } from "expo-symbols"
import { Pressable, StyleSheet, Text, View } from "react-native"
import type { MobileListingDetail } from "@reswell/api-contract"
import { fontFamily, useReswellColors } from "@/theme"

function statusLabel(status: string): string | null {
  if (status === "active") return null
  if (status === "pending_sale") return "Pending sale"
  if (status === "sold") return "Sold"
  return status.replace(/_/g, " ")
}

function boardTypeLabel(value: string | null): string | null {
  if (!value) return null
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export function ListingDetail({ listing }: { listing: MobileListingDetail }) {
  const colors = useReswellColors()
  const identity = [listing.brand, listing.model].filter(Boolean).join(" · ")
  const status = statusLabel(listing.status)
  const facts = [listing.condition_line, boardTypeLabel(listing.board_type), listing.dimensions].filter(
    (fact): fact is string => Boolean(fact),
  )

  return (
    <View style={styles.body}>
      <View style={styles.priceRow}>
        <Text style={[styles.price, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
          {listing.price_label}
        </Text>
        {status ? (
          <View style={[styles.status, { backgroundColor: colors.image }]}>
            <Text style={[styles.statusLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>{status}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.title, { color: colors.foreground, fontFamily: fontFamily.headline }]}>{listing.title}</Text>
      {identity ? (
        <Text style={[styles.identity, { color: colors.muted, fontFamily: fontFamily.text }]}>{identity}</Text>
      ) : null}
      {facts.length > 0 ? (
        <View style={styles.facts}>
          {facts.map((fact) => (
            <View key={fact} style={[styles.fact, { backgroundColor: colors.image }]}>
              <Text style={[styles.factLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>{fact}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {listing.shipping_label || listing.pickup_label ? (
        <View style={[styles.fulfillment, { borderColor: colors.border }]}>
          {listing.shipping_label ? (
            <View style={styles.fulfillmentRow}>
              <SymbolView name={{ ios: "truck.box", android: "local_shipping", web: "local_shipping" }} size={18} tintColor={colors.foreground} />
              <Text style={[styles.fulfillmentText, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                {listing.shipping_label}
              </Text>
            </View>
          ) : null}
          {listing.pickup_label ? (
            <View style={styles.fulfillmentRow}>
              <SymbolView name={{ ios: "mappin", android: "location_on", web: "location_on" }} size={18} tintColor={colors.foreground} />
              <Text style={[styles.fulfillmentText, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                {listing.pickup_label}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
      <SellerRow listing={listing} />
      {listing.description ? (
        <View style={styles.details}>
          <Text style={[styles.detailsTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>Details</Text>
          <Text style={[styles.description, { color: colors.foreground, fontFamily: fontFamily.text }]}>
            {listing.description}
          </Text>
        </View>
      ) : null}
    </View>
  )
}

function SellerRow({ listing }: { listing: MobileListingDetail }) {
  const colors = useReswellColors()
  const body = (
    <View style={[styles.seller, { borderColor: colors.border }]}>
      <View style={[styles.avatar, { backgroundColor: colors.image }]}>
        <Text style={[styles.avatarLabel, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
          {listing.seller.name.slice(0, 1).toUpperCase()}
        </Text>
      </View>
      <View style={styles.sellerCopy}>
        <Text style={[styles.sellerName, { color: colors.foreground, fontFamily: fontFamily.text }]}>{listing.seller.name}</Text>
        <Text style={[styles.sellerHint, { color: colors.muted, fontFamily: fontFamily.text }]}>
          {listing.seller.seller_slug ? "View shop" : "Seller"}
        </Text>
      </View>
      {listing.seller.seller_slug ? (
        <SymbolView name={{ ios: "chevron.right", android: "chevron_right", web: "chevron_right" }} size={16} tintColor={colors.muted} />
      ) : null}
    </View>
  )
  if (!listing.seller.seller_slug) return body
  return (
    <Link href={{ pathname: "/profile/[slug]", params: { slug: listing.seller.seller_slug } }} asChild>
      <Pressable>{body}</Pressable>
    </Link>
  )
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 24, gap: 10 },
  priceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  price: { fontSize: 32, fontWeight: "700", letterSpacing: -0.6 },
  status: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusLabel: { fontSize: 13, fontWeight: "600" },
  title: { fontSize: 26, fontWeight: "700", letterSpacing: -0.5, lineHeight: 31 },
  identity: { fontSize: 15 },
  facts: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  fact: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  factLabel: { fontSize: 13, fontWeight: "600" },
  fulfillment: { marginTop: 6, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 12, gap: 10 },
  fulfillmentRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  fulfillmentText: { flex: 1, fontSize: 15 },
  seller: {
    marginTop: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarLabel: { fontSize: 18, fontWeight: "700" },
  sellerCopy: { flex: 1, gap: 2 },
  sellerName: { fontSize: 16, fontWeight: "600" },
  sellerHint: { fontSize: 13 },
  details: { marginTop: 8, gap: 8 },
  detailsTitle: { fontSize: 20, fontWeight: "700", letterSpacing: -0.3 },
  description: { fontSize: 16, lineHeight: 24 },
})
