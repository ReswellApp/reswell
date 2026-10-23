import { Image } from "expo-image"
import { Stack, useLocalSearchParams, useRouter } from "expo-router"
import { useCallback, useState } from "react"
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { AccountState } from "@/components/account-state"
import { fetchSale, fetchSaleLabel } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useAccountResource } from "@/lib/use-account-resource"
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

export default function SaleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const load = useCallback(
    (token: string) => {
      if (!id) return Promise.reject(new Error("Missing sale"))
      return fetchSale(token, id)
    },
    [id],
  )
  const { data, error, loading, reload } = useAccountResource(load)

  return (
    <AccountState
      title={data ? `Order ${data.order_number}` : "Sale"}
      loading={loading}
      error={error}
      onRetry={reload}
      empty="Sale not found."
      isEmpty={!data}
    >
      {data ? <SaleBody /> : null}
    </AccountState>
  )

  function SaleBody() {
    if (!data) return null
    return <SaleDetail sale={data} />
  }
}

function SaleDetail({ sale }: { sale: NonNullable<Awaited<ReturnType<typeof fetchSale>>> }) {
  const colors = useReswellColors()
  const router = useRouter()
  const { session } = useAuth()
  const [labelError, setLabelError] = useState<string | null>(null)
  const [openingLabel, setOpeningLabel] = useState(false)
  const rows = [
    ["Buyer paid", sale.buyer_paid_label],
    ["Shipping", sale.shipping_label],
    ["Reswell fee", sale.fee_label],
    ["You earn", sale.seller_earnings_label],
  ]
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Stack.Screen options={{ title: `Order ${sale.order_number}` }} />
      <View style={styles.identity}>
        {sale.listing_image_url ? (
          <Image source={{ uri: sale.listing_image_url }} style={[styles.image, { backgroundColor: colors.image }]} contentFit="cover" />
        ) : (
          <View style={[styles.image, { backgroundColor: colors.image }]} />
        )}
        <View style={styles.copy}>
          <Text style={[styles.status, { color: colors.muted, fontFamily: fontFamily.text }]}>{sale.status_label}</Text>
          <Text style={[styles.title, { color: colors.foreground, fontFamily: fontFamily.headline }]}>{sale.listing_title}</Text>
          <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>
            {sale.created_label} · {sale.counterparty_name}
          </Text>
          <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>{sale.fulfillment_label}</Text>
        </View>
      </View>
      <View style={[styles.card, { borderColor: colors.border }]}>
        {rows.map(([label, value]) => (
          <View key={label} style={styles.line}>
            <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>{label}</Text>
            <Text style={[styles.value, { color: colors.foreground, fontFamily: fontFamily.text }]}>{value}</Text>
          </View>
        ))}
        {sale.payout_status ? (
          <View style={styles.line}>
            <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>Payout</Text>
            <Text style={[styles.value, { color: colors.foreground, fontFamily: fontFamily.text }]}>{sale.payout_status}</Text>
          </View>
        ) : null}
      </View>
      {sale.ship_to ? (
        <View style={styles.block}>
          <Text style={[styles.heading, { color: colors.foreground, fontFamily: fontFamily.headline }]}>Ship to</Text>
          <Text style={[styles.body, { color: colors.foreground, fontFamily: fontFamily.text }]}>{sale.ship_to}</Text>
        </View>
      ) : null}
      {sale.tracking_number ? (
        <View style={styles.block}>
          <Text style={[styles.heading, { color: colors.foreground, fontFamily: fontFamily.headline }]}>Tracking</Text>
          <Text style={[styles.body, { color: colors.foreground, fontFamily: fontFamily.text }]}>
            {[sale.tracking_carrier, sale.tracking_number].filter(Boolean).join(" · ")}
          </Text>
        </View>
      ) : null}
      <View style={styles.actions}>
        {sale.listing_id ? (
          <Pressable
            onPress={() => router.push({ pathname: "/listing/[id]", params: { id: sale.listing_slug || sale.listing_id || "" } })}
            style={[styles.button, { backgroundColor: colors.image }]}
          >
            <Text style={[styles.buttonLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>View sold listing</Text>
          </Pressable>
        ) : null}
        {sale.conversation_id ? (
          <Pressable
            onPress={() => router.push({ pathname: "/account/messages/[id]", params: { id: sale.conversation_id || "" } })}
            style={[styles.button, { backgroundColor: colors.image }]}
          >
            <Text style={[styles.buttonLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>Message buyer</Text>
          </Pressable>
        ) : null}
        {sale.label_available ? (
          <Pressable
            disabled={openingLabel}
            onPress={() => {
              const token = session?.access_token
              if (!token || openingLabel) return
              setOpeningLabel(true)
              setLabelError(null)
              void fetchSaleLabel(token, sale.id)
                .then((label) => Linking.openURL(label.url))
                .catch((cause: unknown) => setLabelError(cause instanceof Error ? cause.message : "Unable to open the shipping label"))
                .finally(() => setOpeningLabel(false))
            }}
            style={[styles.button, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.buttonLabel, { color: colors.primaryForeground, fontFamily: fontFamily.text }]}>
              {openingLabel ? "Opening label…" : "View label"}
            </Text>
          </Pressable>
        ) : null}
        {sale.tracking_number ? (
          <Pressable onPress={() => void Linking.openURL(trackingUrl(sale.tracking_number ?? ""))} style={[styles.button, { backgroundColor: colors.primary }]}>
            <Text style={[styles.buttonLabel, { color: colors.primaryForeground, fontFamily: fontFamily.text }]}>Track package</Text>
          </Pressable>
        ) : null}
      </View>
      {labelError ? <Text style={[styles.body, { color: colors.destructive, fontFamily: fontFamily.text }]}>{labelError}</Text> : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { padding: 16, paddingBottom: 48, gap: 16 },
  identity: { flexDirection: "row", gap: 12 },
  image: { width: 84, height: 112, borderRadius: 12 },
  copy: { flex: 1, gap: 4 },
  status: { fontSize: 12, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase" },
  title: { fontSize: 20, fontWeight: "700" },
  meta: { fontSize: 14 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 14, gap: 10 },
  line: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  value: { fontSize: 15, fontWeight: "700" },
  block: { gap: 6 },
  heading: { fontSize: 16, fontWeight: "700" },
  body: { fontSize: 15, lineHeight: 22 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  button: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  buttonLabel: { fontSize: 14, fontWeight: "700" },
})
