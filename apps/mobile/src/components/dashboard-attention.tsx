import type { Href } from "expo-router"
import { Pressable, StyleSheet, Text, View } from "react-native"
import type { MobileDashboard } from "@reswell/api-contract"
import { fontFamily, useReswellColors } from "@/theme"

export function DashboardAttention({
  data,
  onOpen,
}: {
  data: MobileDashboard | null
  onOpen: (href: Href) => void
}) {
  const colors = useReswellColors()
  if (!data) return null
  const items: { label: string; href: Href }[] = []
  if (data.pending_offer_count > 0) {
    items.push({
      label: data.pending_offer_count === 1 ? "1 offer needs you" : `${data.pending_offer_count} offers need you`,
      href: "/account/offers",
    })
  }
  if (data.unread_message_count > 0) {
    items.push({
      label: data.unread_message_count === 1 ? "1 unread message" : `${data.unread_message_count} unread messages`,
      href: "/account/messages",
    })
  }
  if (data.wallet_balance_usd > 0) {
    items.push({ label: `${data.wallet_balance_label} ready to cash out`, href: "/account/earnings" })
  }

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: colors.foreground, fontFamily: fontFamily.headline }]}>Needs you</Text>
      {items.length === 0 ? (
        <Text style={[styles.quiet, { color: colors.muted, fontFamily: fontFamily.text }]}>Nothing needs you right now.</Text>
      ) : (
        items.map((item) => (
          <Pressable key={item.label} onPress={() => onOpen(item.href)} style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>{item.label}</Text>
          </Pressable>
        ))
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8, gap: 4 },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 4 },
  row: { paddingVertical: 10 },
  rowLabel: { fontSize: 16, fontWeight: "600" },
  quiet: { fontSize: 15, lineHeight: 21, paddingVertical: 6 },
})
