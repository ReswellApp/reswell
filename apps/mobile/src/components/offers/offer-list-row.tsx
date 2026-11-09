import { Image } from "expo-image"
import { Link } from "expo-router"
import { SymbolView } from "expo-symbols"
import { Pressable, StyleSheet, Text, View } from "react-native"
import type { MobileOffer, MobilePurchaseStatusTone } from "@reswell/api-contract"
import { OfferActions } from "@/components/offers/offer-actions"
import {
  offerAskingLine,
  offerExpiresLabel,
  offerHint,
  offerPartyLine,
  offerPriorAmountLine,
  offerStatusLabel,
  offerStatusTone,
} from "@/lib/offer-display"
import { fontFamily, useReswellColors } from "@/theme"

const STATUS_PILL: Record<MobilePurchaseStatusTone, { backgroundColor: string; color: string }> = {
  success: { backgroundColor: "#DCFCE7", color: "#15803D" },
  warning: { backgroundColor: "#FEF3C7", color: "#92400E" },
  danger: { backgroundColor: "#FFE4E6", color: "#BE123C" },
  neutral: { backgroundColor: "#F1F5F9", color: "#475569" },
}

export function OfferListRow({ item, onReload }: { item: MobileOffer; onReload: () => void }) {
  const colors = useReswellColors()
  const accent = colors.sellerProfileBannerDefault
  const pill = STATUS_PILL[offerStatusTone(item)]
  const href = { pathname: "/listing/[id]" as const, params: { id: item.listing_id } }
  const asking = offerAskingLine(item)
  const prior = offerPriorAmountLine(item)
  const expires = offerExpiresLabel(item)
  const hint = offerHint(item)

  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <View style={styles.body}>
        <Link href={href} asChild>
          <Pressable accessibilityRole="link" accessibilityLabel={item.listing_title}>
            {item.listing_image_url ? (
              <Image
                source={{ uri: item.listing_image_url }}
                style={[styles.image, { backgroundColor: colors.image }]}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.image, styles.imageFallback, { backgroundColor: colors.image }]}>
                <SymbolView
                  name={{ ios: "shippingbox", android: "inventory_2", web: "inventory_2" }}
                  size={22}
                  tintColor={colors.muted}
                />
              </View>
            )}
          </Pressable>
        </Link>
        <View style={styles.copy}>
          <Link href={href} asChild>
            <Pressable accessibilityRole="link" accessibilityLabel={item.listing_title}>
              <Text numberOfLines={2} style={[styles.title, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
                {item.listing_title}
              </Text>
            </Pressable>
          </Link>
          <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>{offerPartyLine(item)}</Text>
          <Text style={[styles.priceLine, { fontFamily: fontFamily.text }]}>
            <Text style={[styles.price, { color: accent }]}>{item.amount_label}</Text>
            {asking ? <Text style={{ color: colors.muted }}> · {asking}</Text> : null}
          </Text>
          {prior ? (
            <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>{prior}</Text>
          ) : null}
          <View style={[styles.pill, { backgroundColor: pill.backgroundColor }]}>
            <Text style={[styles.pillLabel, { color: pill.color, fontFamily: fontFamily.text }]}>
              {offerStatusLabel(item)}
            </Text>
          </View>
          {item.note ? (
            <Text numberOfLines={2} style={[styles.note, { color: colors.foreground, fontFamily: fontFamily.text }]}>
              {item.note}
            </Text>
          ) : null}
          {hint ? (
            <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>{hint}</Text>
          ) : null}
          {expires ? (
            <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>{expires}</Text>
          ) : null}
          <OfferActions offer={item} onDone={onReload} />
          <Link href={href} asChild>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`View listing for ${item.listing_title}`}
              style={styles.more}
            >
              <Text style={[styles.moreLabel, { color: accent, fontFamily: fontFamily.text }]}>View listing</Text>
              <SymbolView
                name={{ ios: "chevron.right", android: "chevron_right", web: "chevron_right" }}
                size={14}
                tintColor={accent}
              />
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
  pill: {
    alignSelf: "flex-start",
    marginTop: 8,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  pillLabel: { fontSize: 12, fontWeight: "600", lineHeight: 16 },
  note: { marginTop: 6, fontSize: 14, lineHeight: 20 },
  more: { marginTop: 8, flexDirection: "row", alignItems: "center", gap: 2 },
  moreLabel: { fontSize: 14, fontWeight: "600" },
})
