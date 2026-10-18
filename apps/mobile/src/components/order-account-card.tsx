import { Image } from "expo-image"
import { useRouter } from "expo-router"
import { Linking, Pressable, StyleSheet, Text, View } from "react-native"
import type { MobileOrder, MobileSale } from "@reswell/api-contract"
import { fontFamily, useReswellColors } from "@/theme"

function trackingUrl(trackingNumber: string): string {
  const number = trackingNumber.trim()
  if (/^1Z/i.test(number)) return `https://www.ups.com/track?tracknum=${encodeURIComponent(number)}`
  const compact = number.replace(/\s/g, "")
  if (/^(94|93|92|420)\d{20,}$/.test(compact)) {
    return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(number)}`
  }
  if (/^\d{12}$/.test(compact) || /^\d{14,15}$/.test(compact)) {
    return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(number)}`
  }
  return `https://www.google.com/search?q=${encodeURIComponent(`track package ${number}`)}`
}

export function OrderAccountCard({ order, earnings }: { order: MobileOrder | MobileSale; earnings?: string | null }) {
  const colors = useReswellColors()
  const router = useRouter()
  return (
    <View style={[styles.card, { borderColor: colors.border }]}>
      <View style={styles.top}>
        {order.listing_image_url ? (
          <Image source={{ uri: order.listing_image_url }} style={[styles.image, { backgroundColor: colors.image }]} contentFit="cover" />
        ) : (
          <View style={[styles.image, { backgroundColor: colors.image }]} />
        )}
        <View style={styles.copy}>
          <Text style={[styles.status, { color: colors.muted, fontFamily: fontFamily.text }]}>{order.status_label}</Text>
          <Text numberOfLines={2} style={[styles.title, { color: colors.foreground, fontFamily: fontFamily.headline }]}>{order.listing_title}</Text>
          <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>
            {order.order_number} · {order.counterparty_name}
          </Text>
          <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>{order.fulfillment_label}</Text>
          <Text style={[styles.price, { color: colors.foreground, fontFamily: fontFamily.text }]}>
            {earnings ? `You earn ${earnings}` : order.amount_label}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        {order.listing_id ? (
          <Pressable
            onPress={() => {
              const listingId = order.listing_id
              if (listingId) router.push({ pathname: "/listing/[id]", params: { id: listingId } })
            }}
            style={[styles.button, { backgroundColor: colors.image }]}
          >
            <Text style={[styles.buttonLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>View listing</Text>
          </Pressable>
        ) : null}
        {order.tracking_number ? (
          <Pressable
            onPress={() => void Linking.openURL(trackingUrl(order.tracking_number ?? ""))}
            style={[styles.button, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.buttonLabel, { color: colors.primaryForeground, fontFamily: fontFamily.text }]}>Track package</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  top: { flexDirection: "row", gap: 12 },
  image: { width: 72, height: 96, borderRadius: 12 },
  copy: { flex: 1, gap: 2 },
  status: { fontSize: 12, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase" },
  title: { fontSize: 16, fontWeight: "700" },
  meta: { fontSize: 13 },
  price: { fontSize: 15, fontWeight: "700", marginTop: 4 },
  actions: { flexDirection: "row", gap: 8 },
  button: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  buttonLabel: { fontSize: 13, fontWeight: "700" },
})
