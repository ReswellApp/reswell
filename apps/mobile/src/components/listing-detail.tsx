import { Link } from "expo-router"
import { SymbolView } from "expo-symbols"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { MOBILE_BOARD_STYLE_FILTERS, type MobileListingDetail } from "@reswell/api-contract"
import { fontFamily, useReswellColors } from "@/theme"

function shapeLabel(boardType: string | null): string | null {
  if (!boardType || boardType === "other") return null
  return MOBILE_BOARD_STYLE_FILTERS.find((item) => item.board_type === boardType)?.label ?? null
}

function specRows(listing: MobileListingDetail): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = []
  if (listing.condition_line) rows.push({ label: "Condition", value: listing.condition_line })
  const shape = shapeLabel(listing.board_type)
  if (shape) rows.push({ label: "Shape", value: shape })
  if (listing.dimensions) rows.push({ label: "Dimensions", value: listing.dimensions })
  return rows
}

export function ListingDetail({ listing }: { listing: MobileListingDetail }) {
  const colors = useReswellColors()
  const sold = listing.status === "sold"
  const pending = listing.status === "pending_sale"
  const rows = specRows(listing)

  return (
    <View style={styles.body}>
      <Text
        numberOfLines={2}
        style={[styles.title, { color: colors.foreground, fontFamily: fontFamily.headline }]}
      >
        {listing.title}
      </Text>
      <Identity brand={listing.brand} model={listing.model} />
      <View style={styles.priceRow}>
        <Text
          style={[
            styles.price,
            { color: sold ? colors.sold : colors.foreground, fontFamily: fontFamily.headline },
          ]}
        >
          {sold ? `Sold for ${listing.price_label}` : listing.price_label}
        </Text>
        {pending ? (
          <View style={[styles.status, { backgroundColor: colors.image }]}>
            <Text style={[styles.statusLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>
              Pending sale
            </Text>
          </View>
        ) : null}
      </View>
      {listing.shipping_label ? (
        <Text style={[styles.shippingNote, { color: colors.shipping, fontFamily: fontFamily.text }]}>
          {listing.shipping_label}
        </Text>
      ) : listing.pickup_label ? (
        <Text style={[styles.shippingNote, { color: colors.muted, fontFamily: fontFamily.text }]}>
          {listing.pickup_label}
        </Text>
      ) : null}
      {rows.length > 0 ? <SpecTable rows={rows} /> : null}
      {listing.shipping_label && listing.pickup_label ? <PickupRow label={listing.pickup_label} /> : null}
      <SellerRow listing={listing} />
      {listing.description ? (
        <View style={[styles.about, { borderTopColor: colors.border }]}>
          <Text style={[styles.aboutTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>
            About this listing
          </Text>
          <Text style={[styles.description, { color: colors.foreground, fontFamily: fontFamily.text }]}>
            {listing.description}
          </Text>
        </View>
      ) : null}
    </View>
  )
}

function Identity({ brand, model }: { brand: string | null; model: string | null }) {
  const colors = useReswellColors()
  const name = brand?.trim() || null
  const shape = model?.trim() || null
  if (!name && !shape) return null
  return (
    <Text style={[styles.identity, { color: colors.foreground, fontFamily: fontFamily.text }]}>
      {name ? <Text style={styles.identityStrong}>{name}</Text> : null}
      {name && shape ? <Text style={{ color: colors.border }}> · </Text> : null}
      {shape ? <Text style={styles.identityStrong}>{shape}</Text> : null}
    </Text>
  )
}

function SpecTable({ rows }: { rows: { label: string; value: string }[] }) {
  const colors = useReswellColors()
  return (
    <View style={[styles.specs, { borderColor: colors.border }]}>
      {rows.map((row, index) => (
        <View
          key={row.label}
          style={[
            styles.specRow,
            index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border } : null,
          ]}
        >
          <Text style={[styles.specLabel, { color: colors.muted, fontFamily: fontFamily.text }]}>{row.label}</Text>
          <Text style={[styles.specValue, { color: colors.foreground, fontFamily: fontFamily.text }]}>{row.value}</Text>
        </View>
      ))}
    </View>
  )
}

function PickupRow({ label }: { label: string }) {
  const colors = useReswellColors()
  return (
    <View style={styles.pickup}>
      <SymbolView name={{ ios: "mappin", android: "location_on", web: "location_on" }} size={16} tintColor={colors.foreground} />
      <Text style={[styles.pickupText, { color: colors.foreground, fontFamily: fontFamily.text }]}>{label}</Text>
    </View>
  )
}

function SellerRow({ listing }: { listing: MobileListingDetail }) {
  const colors = useReswellColors()
  const body = (
    <View style={[styles.seller, { borderTopColor: colors.border }]}>
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
  body: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28 },
  title: { fontSize: 22, fontWeight: "700", letterSpacing: -0.44, lineHeight: 28 },
  identity: { marginTop: 6, fontSize: 15, lineHeight: 20 },
  identityStrong: { fontWeight: "600" },
  priceRow: { marginTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  price: { fontSize: 30, fontWeight: "700", letterSpacing: -0.6, lineHeight: 34 },
  status: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusLabel: { fontSize: 13, fontWeight: "600" },
  shippingNote: { marginTop: 4, fontSize: 14, fontWeight: "500" },
  specs: { marginTop: 20, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  specRow: { flexDirection: "row", alignItems: "baseline", gap: 16, paddingVertical: 8 },
  specLabel: { width: 116, fontSize: 13, fontWeight: "500" },
  specValue: { flex: 1, fontSize: 13, lineHeight: 18 },
  pickup: { marginTop: 16, flexDirection: "row", alignItems: "flex-start", gap: 10 },
  pickupText: { flex: 1, fontSize: 14, fontWeight: "600", lineHeight: 19 },
  seller: {
    marginTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarLabel: { fontSize: 18, fontWeight: "700" },
  sellerCopy: { flex: 1, gap: 2 },
  sellerName: { fontSize: 16, fontWeight: "600" },
  sellerHint: { fontSize: 13 },
  about: { marginTop: 20, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 16, gap: 8 },
  aboutTitle: { fontSize: 16, fontWeight: "500" },
  description: { fontSize: 16, lineHeight: 26 },
})
