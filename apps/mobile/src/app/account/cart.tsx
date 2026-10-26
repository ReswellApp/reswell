import { Image } from "expo-image"
import { useRouter } from "expo-router"
import { useEffect } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { AccountState } from "@/components/account-state"
import { VerticalScroll } from "@/components/horizontal-rail"
import { fetchCart, setCartItem } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useAuthGate } from "@/lib/auth-gate"
import { useAccountResource } from "@/lib/use-account-resource"
import { fontFamily, useReswellColors } from "@/theme"

export default function CartScreen() {
  const colors = useReswellColors()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { session } = useAuth()
  const { requestAuth } = useAuthGate()
  const { data, error, loading, reload } = useAccountResource(fetchCart)
  const items = data?.items ?? []
  const subtotal = items.reduce((sum, item) => sum + item.listing.price_usd * item.quantity, 0)

  useEffect(() => {
    if (session?.access_token) return
    requestAuth()
  }, [requestAuth, session?.access_token])

  if (!session?.access_token) {
    return (
      <AccountState
        title="Cart"
        loading={false}
        error={null}
        onRetry={() => requestAuth()}
        empty="Sign in to see your cart."
        isEmpty
      >
        {null}
      </AccountState>
    )
  }

  return (
    <AccountState
      title="Cart"
      loading={loading}
      error={error}
      onRetry={reload}
      empty="Your cart is empty."
      isEmpty={items.length === 0}
    >
      <VerticalScroll contentContainerStyle={styles.list}>
        {items.length > 1 ? (
          <Text style={[styles.note, { color: colors.muted, fontFamily: fontFamily.text }]}>
            Checkout is one item at a time.
          </Text>
        ) : null}
        {items.map((item) => {
          const fulfillment = [
            item.listing.shipping_available ? "Shipping" : null,
            item.listing.local_pickup ? "Local pickup" : null,
          ]
            .filter(Boolean)
            .join(" · ")
          return (
            <View key={item.listing.id} style={[styles.card, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Pressable
                onPress={() =>
                  router.push({ pathname: "/listing/[id]", params: { id: item.listing.slug || item.listing.id } })
                }
                style={styles.item}
              >
                {item.listing.image_url ? (
                  <Image source={{ uri: item.listing.image_url }} style={[styles.image, { backgroundColor: colors.image }]} contentFit="cover" />
                ) : (
                  <View style={[styles.image, { backgroundColor: colors.image }]} />
                )}
                <View style={styles.copy}>
                  <Text numberOfLines={2} style={[styles.title, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                    {item.listing.title}
                  </Text>
                  <Text style={[styles.price, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                    {item.listing.price_label}
                    {item.quantity > 1 ? ` · Qty ${item.quantity}` : ""}
                  </Text>
                  {fulfillment ? (
                    <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>{fulfillment}</Text>
                  ) : null}
                </View>
              </Pressable>
              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({ pathname: "/account/checkout", params: { listing: item.listing.id } })
                  }
                  style={[styles.checkout, { backgroundColor: colors.foreground }]}
                >
                  <Text style={[styles.checkoutLabel, { color: colors.primaryForeground, fontFamily: fontFamily.text }]}>
                    Checkout
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => {
                    const token = session?.access_token
                    if (!token) return
                    void setCartItem(token, item.listing.id, 0).then(() => reload())
                  }}
                  style={styles.removeButton}
                >
                  <Text style={[styles.remove, { color: colors.destructive, fontFamily: fontFamily.text }]}>Remove</Text>
                </Pressable>
              </View>
            </View>
          )
        })}
      </VerticalScroll>
      <View
        style={[
          styles.footer,
          { borderColor: colors.border, backgroundColor: colors.background, paddingBottom: Math.max(insets.bottom, 16) },
        ]}
      >
        <View style={styles.footerCopy}>
          <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>Subtotal</Text>
          <Text style={[styles.total, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
            ${subtotal.toFixed(2)}
          </Text>
        </View>
      </View>
    </AccountState>
  )
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 140, gap: 14 },
  note: { fontSize: 14, lineHeight: 20, paddingHorizontal: 2 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 14 },
  item: { flexDirection: "row", gap: 12 },
  image: { width: 88, height: 88, borderRadius: 12 },
  copy: { flex: 1, gap: 4, paddingTop: 2 },
  title: { fontSize: 16, fontWeight: "600", lineHeight: 21 },
  price: { fontSize: 16, fontWeight: "700" },
  meta: { fontSize: 13 },
  actions: { flexDirection: "row", alignItems: "center", gap: 10 },
  checkout: { flex: 1, borderRadius: 12, alignItems: "center", justifyContent: "center", minHeight: 44 },
  checkoutLabel: { fontSize: 15, fontWeight: "700" },
  removeButton: { minHeight: 44, paddingHorizontal: 8, alignItems: "center", justifyContent: "center" },
  remove: { fontSize: 15, fontWeight: "600" },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  footerCopy: { gap: 2 },
  total: { fontSize: 22, fontWeight: "700" },
})
