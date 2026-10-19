import { Image } from "expo-image"
import { useRouter } from "expo-router"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { AccountState } from "@/components/account-state"
import { VerticalScroll } from "@/components/horizontal-rail"
import { fetchCart, setCartItem } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useAccountResource } from "@/lib/use-account-resource"
import { fontFamily, useReswellColors } from "@/theme"

export default function CartScreen() {
  const colors = useReswellColors()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { session } = useAuth()
  const { data, error, loading, reload } = useAccountResource(fetchCart)
  const items = data?.items ?? []
  const subtotal = items.reduce((sum, item) => sum + item.listing.price_usd * item.quantity, 0)

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
        {items.map((item) => (
          <View key={item.listing.id} style={[styles.row, { borderColor: colors.border }]}>
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
                <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>
                  {[item.listing.shipping_available ? "Shipping" : null, item.listing.local_pickup ? "Local pickup" : null]
                    .filter(Boolean)
                    .join(" · ") || "Checkout"}
                </Text>
              </View>
            </Pressable>
            <View style={styles.actions}>
              <Pressable
                onPress={() =>
                  router.push({ pathname: "/account/checkout", params: { listing: item.listing.id } })
                }
              >
                <Text style={[styles.checkoutItem, { color: colors.foreground, fontFamily: fontFamily.text }]}>Checkout</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const token = session?.access_token
                  if (!token) return
                  void setCartItem(token, item.listing.id, 0).then(() => reload())
                }}
              >
                <Text style={[styles.remove, { color: colors.destructive, fontFamily: fontFamily.text }]}>Remove</Text>
              </Pressable>
            </View>
          </View>
        ))}
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
        {items.length === 1 ? (
          <Pressable
            onPress={() =>
              router.push({ pathname: "/account/checkout", params: { listing: items[0]?.listing.id ?? "" } })
            }
            style={[styles.checkout, { backgroundColor: colors.foreground }]}
          >
            <Text style={[styles.checkoutLabel, { color: colors.primaryForeground, fontFamily: fontFamily.text }]}>Checkout</Text>
          </Pressable>
        ) : null}
      </View>
    </AccountState>
  )
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, paddingBottom: 120 },
  row: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 14, gap: 8 },
  item: { flexDirection: "row", gap: 12 },
  image: { width: 84, height: 84, borderRadius: 12 },
  copy: { flex: 1, gap: 4 },
  title: { fontSize: 16, fontWeight: "600", lineHeight: 21 },
  price: { fontSize: 15, fontWeight: "700" },
  meta: { fontSize: 13 },
  actions: { flexDirection: "row", alignItems: "center", gap: 16 },
  checkoutItem: { fontSize: 14, fontWeight: "700" },
  remove: { fontSize: 14, fontWeight: "600" },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  footerCopy: { gap: 2 },
  total: { fontSize: 22, fontWeight: "700" },
  checkout: { flex: 1, borderRadius: 14, alignItems: "center", paddingVertical: 14 },
  checkoutLabel: { fontSize: 16, fontWeight: "700" },
})
