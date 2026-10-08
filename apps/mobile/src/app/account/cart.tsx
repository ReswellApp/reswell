import { useRouter } from "expo-router"
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native"
import { AccountState } from "@/components/account-state"
import { ListingCard } from "@/components/listing-card"
import { fetchCart, setCartItem } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useAccountResource } from "@/lib/use-account-resource"
import { fontFamily, useReswellColors } from "@/theme"

export default function CartScreen() {
  const colors = useReswellColors()
  const router = useRouter()
  const { session } = useAuth()
  const { data, error, loading, reload } = useAccountResource(fetchCart)
  const items = data?.items ?? []
  const grid = items.length % 2 === 1 ? [...items, null] : items

  return (
    <AccountState
      title="Cart"
      loading={loading}
      error={error}
      onRetry={reload}
      empty="Your cart is empty."
      isEmpty={items.length === 0}
    >
      <FlatList
        data={grid}
        keyExtractor={(item) => item?.listing.id ?? "spacer"}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        refreshing={loading}
        onRefresh={reload}
        renderItem={({ item }) =>
          item ? (
            <View style={styles.cell}>
              <ListingCard
                item={item.listing}
                onPress={() =>
                  router.push({
                    pathname: "/listing/[id]",
                    params: { id: item.listing.slug || item.listing.id },
                  })
                }
              />
              {item.quantity > 1 ? (
                <Text style={[styles.qty, { color: colors.muted, fontFamily: fontFamily.text }]}>
                  Qty {item.quantity}
                </Text>
              ) : null}
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
          ) : (
            <View style={styles.spacer} />
          )
        }
      />
    </AccountState>
  )
}

const styles = StyleSheet.create({
  list: { paddingTop: 12, paddingBottom: 28 },
  row: { gap: 12, paddingHorizontal: 12 },
  cell: { flex: 1 },
  spacer: { flex: 1 },
  qty: { fontSize: 13, marginTop: -12, marginBottom: 4 },
  remove: { fontSize: 15, fontWeight: "600", marginBottom: 12 },
})
