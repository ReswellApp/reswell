import { SymbolView } from "expo-symbols"
import { Linking, Pressable, StyleSheet, Text, View } from "react-native"
import type { MobileListingDetail } from "@reswell/api-contract"
import { publicApiUrl } from "@/lib/public-env"
import { fontFamily, useReswellColors } from "@/theme"

export function ListingFulfillment({ listing }: { listing: MobileListingDetail }) {
  const colors = useReswellColors()
  const sold = listing.status === "sold"
  const offersShipping = listing.shipping_available
  const offersPickup = listing.local_pickup
  const headline = offersShipping && offersPickup
    ? "Shipping or local pickup"
    : offersShipping
      ? "Shipping"
      : "Local pickup"
  const detail = [listing.shipping_label, listing.location_line ? `from ${listing.location_line}` : null]
    .filter(Boolean)
    .join(" ")
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
          <NoteRow icon="truck.box" android="local_shipping" title={headline} detail={detail || null} />
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
            onTitlePress={() => void Linking.openURL(`${publicApiUrl()}/protection-policy`)}
          />
        </>
      )}
      {listing.location_line ? (
        <Text style={[styles.place, { color: colors.foreground, fontFamily: fontFamily.text }]}>{listing.location_line}</Text>
      ) : null}
      {sold || !offersPickup ? null : (
        <Text style={[styles.copy, { color: colors.muted, fontFamily: fontFamily.text }]}>
          <Text style={{ color: colors.foreground, fontWeight: "700" }}>Local pickup</Text>
          {" — available. Meet the seller near this area to inspect the board."}
        </Text>
      )}
      {sold || !offersShipping ? null : (
        <Text style={[styles.copy, { color: colors.muted, fontFamily: fontFamily.text }]}>
          <Text style={{ color: colors.foreground, fontWeight: "700" }}>Shipping</Text>
          {listing.shipping_label ? ` — available. ${listing.shipping_label}.` : " — available."}
        </Text>
      )}
      {sold || listing.section !== "surfboards" ? null : (
        <Text style={[styles.copy, { color: colors.muted, fontFamily: fontFamily.text }]}>
          Inspect for cracks, dings, or delamination before you pay.
        </Text>
      )}
      {listing.listed_label ? (
        <Text style={[styles.listed, { color: colors.muted, fontFamily: fontFamily.text }]}>
          Listed: <Text style={{ color: colors.foreground, fontWeight: "700" }}>{listing.listed_label}</Text>
        </Text>
      ) : null}
      {sold ? null : <ProtectionCard />}
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
  const titleNode = (
    <Text style={[styles.noteTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>{title}</Text>
  )
  return (
    <View style={styles.note}>
      <SymbolView name={{ ios: icon, android, web: android }} size={18} tintColor={colors.shipping} />
      <Text style={[styles.noteCopy, { color: colors.muted, fontFamily: fontFamily.text }]}>
        {onTitlePress ? (
          <Text style={styles.dashed} onPress={onTitlePress}>
            {titleNode}
          </Text>
        ) : (
          titleNode
        )}
        {detail ? ` ${detail}` : null}
      </Text>
    </View>
  )
}

function ProtectionCard() {
  const colors = useReswellColors()
  return (
    <View style={[styles.protection, { backgroundColor: colors.protection }]}>
      <SymbolView name={{ ios: "checkmark.shield", android: "verified_user", web: "verified_user" }} size={22} tintColor={colors.shipping} />
      <View style={styles.protectionCopy}>
        <Text style={[styles.protectionTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>
          Reswell protection
        </Text>
        <Text style={[styles.protectionBody, { color: colors.foreground, fontFamily: fontFamily.text }]}>
          Shop knowing eligible purchases include Purchase Protection—clear coverage rules, a dispute path if the item isn’t as described, and our team when you need a hand.
        </Text>
        <Pressable onPress={() => void Linking.openURL(`${publicApiUrl()}/protection-policy`)}>
          <Text style={[styles.learn, { color: colors.shipping, fontFamily: fontFamily.text }]}>Learn more</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  block: { marginTop: 18, gap: 12 },
  note: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  noteCopy: { flex: 1, fontSize: 15, lineHeight: 21 },
  noteTitle: { fontWeight: "700" },
  dashed: { textDecorationLine: "underline", textDecorationStyle: "dashed" },
  place: { marginTop: 8, fontSize: 13, fontWeight: "700", letterSpacing: 0.4 },
  copy: { fontSize: 15, lineHeight: 22 },
  listed: { marginTop: 4, fontSize: 14 },
  protection: { marginTop: 8, borderRadius: 16, padding: 16, flexDirection: "row", gap: 12 },
  protectionCopy: { flex: 1, gap: 6 },
  protectionTitle: { fontSize: 16, fontWeight: "700" },
  protectionBody: { fontSize: 14, lineHeight: 20 },
  learn: { fontSize: 14, fontWeight: "700", textDecorationLine: "underline" },
})
