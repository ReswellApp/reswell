import { StyleSheet, Text, View } from "react-native"
import type { MobileListingDetail } from "@reswell/api-contract"
import { fontFamily, useReswellColors } from "@/theme"

/** Small lines under list price — shipping rate and/or local pickup (matches website PDP). */
export function ListingDeliveryCaption({ listing }: { listing: MobileListingDetail }) {
  const colors = useReswellColors()
  if (listing.status === "sold") return null

  const shippingLine =
    listing.shipping_available && listing.shipping_label?.trim() ? listing.shipping_label.trim() : null
  const pickupLine = listing.local_pickup && listing.pickup_label?.trim() ? listing.pickup_label.trim() : null

  if (!shippingLine && !pickupLine) return null

  return (
    <View style={styles.wrap}>
      {shippingLine ? (
        <Text style={[styles.shipping, { color: colors.shipping, fontFamily: fontFamily.text }]}>{shippingLine}</Text>
      ) : null}
      {pickupLine ? (
        <Text style={[styles.pickup, { color: colors.muted, fontFamily: fontFamily.text }]}>{pickupLine}</Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginTop: 4, gap: 2 },
  shipping: { fontSize: 14, fontWeight: "600", lineHeight: 18 },
  pickup: { fontSize: 13, lineHeight: 17, fontWeight: "500" },
})
