import { Image } from "expo-image"
import { Link } from "expo-router"
import { SymbolView } from "expo-symbols"
import { Pressable, StyleSheet, Text, View } from "react-native"
import type { MobilePurchaseStatusTone, MobileSaleListItem } from "@reswell/api-contract"
import { formatPurchaseDate } from "@/lib/purchase-display"
import { fontFamily, useReswellColors } from "@/theme"

const STATUS_PILL: Record<MobilePurchaseStatusTone, { backgroundColor: string; color: string }> = {
  success: { backgroundColor: "#DCFCE7", color: "#15803D" },
  warning: { backgroundColor: "#FEF3C7", color: "#92400E" },
  danger: { backgroundColor: "#FFE4E6", color: "#BE123C" },
  neutral: { backgroundColor: "#F1F5F9", color: "#475569" },
}

export function SaleOrderRow({ item }: { item: MobileSaleListItem }) {
  const colors = useReswellColors()
  const accent = colors.sellerProfileBannerDefault
  const pill = STATUS_PILL[item.status_tone]
  const href = { pathname: "/account/sales/[id]" as const, params: { id: item.id } }

  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <View style={styles.body}>
        {item.listing_image_url ? (
          <Image source={{ uri: item.listing_image_url }} style={[styles.image, { backgroundColor: colors.image }]} contentFit="cover" />
        ) : (
          <View style={[styles.image, styles.imageFallback, { backgroundColor: colors.image }]}>
            <SymbolView name={{ ios: "shippingbox", android: "inventory_2", web: "inventory_2" }} size={22} tintColor={colors.muted} />
          </View>
        )}
        <View style={styles.copy}>
          <Link href={href} asChild>
            <Pressable accessibilityRole="link" accessibilityLabel={item.listing_title}>
              <Text numberOfLines={2} style={[styles.title, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
                {item.listing_title}
              </Text>
            </Pressable>
          </Link>
          <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>to {item.buyer_name}</Text>
          {item.detail_line ? (
            <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>{item.detail_line}</Text>
          ) : null}
          <Text style={[styles.priceLine, { fontFamily: fontFamily.text }]}>
            <Text style={[styles.price, { color: accent, textDecorationLine: item.amount_struck ? "line-through" : "none" }]}>
              {item.seller_earnings_label}
            </Text>
            {item.primary_suffix ? (
              <Text style={{ color: colors.muted }}> {item.primary_suffix}</Text>
            ) : null}
            {item.show_shipping ? (
              <Text style={{ color: colors.muted }}> + {item.shipping_amount_label} shipping</Text>
            ) : null}
          </Text>
          {item.refund_note ? (
            <Text style={[styles.refund, { color: item.amount_struck ? colors.destructive : "#92400E", fontFamily: fontFamily.text }]}>
              {item.refund_note}
            </Text>
          ) : null}
          <View style={[styles.pill, { backgroundColor: pill.backgroundColor }]}>
            <Text style={[styles.pillLabel, { color: pill.color, fontFamily: fontFamily.text }]}>{item.status_label}</Text>
          </View>
          <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>
            Sold: {formatPurchaseDate(item.created_at)}
          </Text>
          <Text selectable style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>
            Order: {item.order_number}
          </Text>
          <Link href={href} asChild>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`More details for ${item.listing_title}, order ${item.order_number}`}
              style={styles.more}
            >
              <Text style={[styles.moreLabel, { color: accent, fontFamily: fontFamily.text }]}>More details</Text>
              <SymbolView name={{ ios: "chevron.right", android: "chevron_right", web: "chevron_right" }} size={14} tintColor={accent} />
            </Pressable>
          </Link>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 16, paddingVertical: 20, borderBottomWidth: StyleSheet.hairlineWidth },
  body: { flexDirection: "row", alignItems: "flex-start", gap: 16 },
  image: { width: 72, height: 72, borderRadius: 10, borderCurve: "continuous" },
  imageFallback: { alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 17, fontWeight: "700", lineHeight: 22 },
  meta: { fontSize: 14, lineHeight: 20 },
  priceLine: { marginTop: 4, fontSize: 15, lineHeight: 20 },
  price: { fontWeight: "700" },
  refund: { marginTop: 4, fontSize: 12, fontWeight: "600" },
  pill: {
    alignSelf: "flex-start",
    marginTop: 8,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  pillLabel: { fontSize: 12, fontWeight: "600", lineHeight: 16 },
  more: { marginTop: 4, flexDirection: "row", alignItems: "center", gap: 2 },
  moreLabel: { fontSize: 14, fontWeight: "600" },
})
