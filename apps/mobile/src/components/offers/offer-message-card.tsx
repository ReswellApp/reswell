import { useRouter } from "expo-router"
import { SymbolView } from "expo-symbols"
import { Pressable, StyleSheet, Text, View } from "react-native"
import type { MobileOffer } from "@reswell/api-contract"
import { OfferActions } from "@/components/offers/offer-actions"
import {
  isOfferPastExpiry,
  offerAskingLine,
  offerExpiresLabel,
  offerHint,
  offerNeedsAction,
  offerThreadHeadline,
  offerThreadNote,
} from "@/lib/offer-display"
import { fontFamily, useReswellColors } from "@/theme"

function offerTone(offer: MobileOffer): { backgroundColor: string; icon: string } {
  if (offer.status === "ACCEPTED" || offer.status === "COMPLETED") {
    return { backgroundColor: "#DCFCE7", icon: "#15803D" }
  }
  if (offer.status === "DECLINED" || offer.status === "EXPIRED" || offer.status === "WITHDRAWN" || isOfferPastExpiry(offer)) {
    return { backgroundColor: "#FEF3C7", icon: "#92400E" }
  }
  if (offer.status === "PENDING" || offer.status === "COUNTERED" || offerNeedsAction(offer)) {
    return { backgroundColor: "#DBEAFE", icon: "#1D4ED8" }
  }
  return { backgroundColor: "#F1F5F9", icon: "#475569" }
}

export function OfferMessageCard({
  offer,
  messageBody,
  createdAt,
  onReload,
}: {
  offer: MobileOffer
  messageBody: string
  createdAt: string
  onReload: () => void
}) {
  const colors = useReswellColors()
  const router = useRouter()
  const tone = offerTone(offer)
  const asking = offerAskingLine(offer)
  const note = offerThreadNote(offer, messageBody)
  const hint = offerHint(offer)
  const expires = offerExpiresLabel(offer)
  const subtitle = [asking, expires].filter(Boolean).join(" · ")

  return (
    <View style={[styles.wrap, { borderColor: colors.foreground, backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View style={[styles.icon, { backgroundColor: tone.backgroundColor }]}>
          <SymbolView
            name={{ ios: "handshake", android: "handshake", web: "handshake" }}
            size={16}
            tintColor={tone.icon}
          />
        </View>
        <View style={styles.headerCopy}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.foreground, fontFamily: fontFamily.text }]}>
              {offerThreadHeadline(offer)}
            </Text>
            <Text style={[styles.amount, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
              {offer.amount_label}
            </Text>
          </View>
          {subtitle ? (
            <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>{subtitle}</Text>
          ) : null}
        </View>
      </View>
      {note ? (
        <Text style={[styles.note, { color: colors.foreground, fontFamily: fontFamily.text }]}>“{note}”</Text>
      ) : null}
      {hint ? <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>{hint}</Text> : null}
      <OfferActions offer={offer} onDone={onReload} compact />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="View offer"
        onPress={() => router.push({ pathname: "/account/offers/[id]", params: { id: offer.id } })}
        style={[styles.viewOffer, { borderColor: colors.border }]}
      >
        <Text style={[styles.viewOfferLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>
          View offer
        </Text>
      </Pressable>
      <Text style={[styles.time, { color: colors.muted, fontFamily: fontFamily.text }]}>{createdAt}</Text>
    </View>
  )
}

export function OfferThreadFallbackCard({
  body,
  title,
  amount,
  createdAt,
}: {
  body: string
  title: string
  amount: string | null
  createdAt: string
}) {
  const colors = useReswellColors()
  return (
    <View style={[styles.wrap, { borderColor: colors.foreground, backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View style={[styles.icon, { backgroundColor: "#F1F5F9" }]}>
          <SymbolView
            name={{ ios: "handshake", android: "handshake", web: "handshake" }}
            size={16}
            tintColor="#475569"
          />
        </View>
        <View style={styles.headerCopy}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.foreground, fontFamily: fontFamily.text }]}>{title}</Text>
            {amount ? (
              <Text style={[styles.amount, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
                {amount}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
      {!amount ? (
        <Text style={[styles.note, { color: colors.foreground, fontFamily: fontFamily.text }]}>{body.trim()}</Text>
      ) : null}
      <Text style={[styles.time, { color: colors.muted, fontFamily: fontFamily.text }]}>{createdAt}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { borderWidth: 2, borderRadius: 16, padding: 14, gap: 8, maxWidth: 320 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  icon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1, minWidth: 0, gap: 2 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  title: { flex: 1, fontSize: 15, fontWeight: "700", lineHeight: 20 },
  amount: { fontSize: 15, fontWeight: "600" },
  meta: { fontSize: 13, lineHeight: 18 },
  note: { fontSize: 13, lineHeight: 18 },
  viewOffer: { borderWidth: 1.5, borderRadius: 12, alignItems: "center", justifyContent: "center", minHeight: 40 },
  viewOfferLabel: { fontSize: 14, fontWeight: "700" },
  time: { fontSize: 11 },
})
