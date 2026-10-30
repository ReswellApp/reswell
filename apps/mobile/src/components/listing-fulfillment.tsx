import { useRouter } from "expo-router"
import { SymbolView } from "expo-symbols"
import { StyleSheet, Text, View } from "react-native"
import { listingFulfillmentPdpCopy, type MobileListingDetail } from "@reswell/api-contract"
import { fontFamily, useReswellColors } from "@/theme"

export function ListingFulfillment({ listing }: { listing: MobileListingDetail }) {
  const colors = useReswellColors()
  const router = useRouter()
  const sold = listing.status === "sold"
  const fulfillment = listingFulfillmentPdpCopy({
    pickupOffered: listing.local_pickup,
    shippingOffered: listing.shipping_available,
    locationLine: listing.location_line,
    shippingLine: listing.shipping_label,
    isSold: sold,
  })
  const cartNote =
    listing.cart_holder_count === 1
      ? "1 other person has this in their cart"
      : listing.cart_holder_count > 1
        ? `${listing.cart_holder_count} other people have this in their cart`
        : null

  return (
    <View style={styles.block}>
      {sold ? null : (
        <>
          {fulfillment ? (
            <NoteRow icon="truck.box" android="local_shipping" title={fulfillment.headline} detail={fulfillment.subline} />
          ) : null}
          <NoteRow
            icon="hourglass"
            android="hourglass_empty"
            title="Only one available"
            detail={cartNote}
          />
          <NoteRow
            icon="checkmark.shield"
            android="verified_user"
            title="Purchase Protection"
            detail="on eligible checkout"
            onTitlePress={() => router.push("/protection-policy")}
          />
        </>
      )}
      {listing.listed_label ? (
        <Text style={[styles.listed, { color: colors.muted, fontFamily: fontFamily.text }]}>
          Listed: <Text style={{ color: colors.foreground, fontWeight: "700" }}>{listing.listed_label}</Text>
        </Text>
      ) : null}
    </View>
  )
}

function NoteRow({
  icon,
  android,
  title,
  detail,
  onTitlePress,
}: {
  icon: string
  android: string
  title: string
  detail: string | null
  onTitlePress?: () => void
}) {
  const colors = useReswellColors()
  return (
    <View style={styles.note}>
      <SymbolView name={{ ios: icon, android, web: android }} size={18} tintColor={colors.shipping} />
      <Text style={[styles.noteCopy, { color: colors.muted, fontFamily: fontFamily.text }]}>
        <Text
          style={[styles.noteTitle, onTitlePress ? styles.link : null, { color: colors.foreground, fontFamily: fontFamily.text }]}
          onPress={onTitlePress}
        >
          {title}
        </Text>
        {detail ? ` ${detail}` : null}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  block: { marginTop: 18, gap: 12 },
  note: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  noteCopy: { flex: 1, fontSize: 15, lineHeight: 21 },
  noteTitle: { fontWeight: "700" },
  link: { textDecorationLine: "underline" },
  listed: { marginTop: 4, fontSize: 14 },
})
