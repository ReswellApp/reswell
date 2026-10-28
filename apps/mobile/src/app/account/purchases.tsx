import { useMemo, useState } from "react"
import { FlatList, StyleSheet, Text, TextInput, View } from "react-native"
import { AccountState } from "@/components/account-state"
import { PurchaseOrderRow } from "@/components/purchases/purchase-order-row"
import { fetchPurchases } from "@/lib/api"
import { purchaseCountLabel, purchaseMatchesQuery } from "@/lib/purchase-display"
import { useAccountResource } from "@/lib/use-account-resource"
import { fontFamily, useReswellColors } from "@/theme"

export default function PurchasesScreen() {
  const colors = useReswellColors()
  const { data, error, loading, reload } = useAccountResource(fetchPurchases)
  const orders = data?.orders ?? []
  const [query, setQuery] = useState("")
  const visible = useMemo(
    () => orders.filter((item) => purchaseMatchesQuery(item, query)),
    [orders, query],
  )
  const searching = query.trim().length > 0
  const countLabel = purchaseCountLabel(searching ? visible.length : orders.length)

  return (
    <AccountState
      title="Purchases"
      loading={loading}
      error={error}
      onRetry={reload}
      empty="When you buy from other members, your orders show up here."
      isEmpty={orders.length === 0}
    >
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={reload}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.count, { color: colors.muted, fontFamily: fontFamily.text }]}>{countLabel}</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="title, seller or order #"
              placeholderTextColor={colors.muted}
              accessibilityLabel="Search purchases by title, seller, or order number"
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              clearButtonMode="while-editing"
              style={[
                styles.search,
                {
                  color: colors.foreground,
                  backgroundColor: colors.background,
                  borderColor: colors.sellerProfileBannerDefault,
                  fontFamily: fontFamily.text,
                },
              ]}
            />
          </View>
        }
        ListEmptyComponent={
          searching ? (
            <Text style={[styles.emptySearch, { color: colors.muted, fontFamily: fontFamily.text }]}>
              No purchases match that search.
            </Text>
          ) : null
        }
        renderItem={({ item }) => <PurchaseOrderRow item={item} />}
      />
    </AccountState>
  )
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, gap: 16 },
  count: { fontSize: 22, fontWeight: "500", lineHeight: 26 },
  search: {
    height: 48,
    borderWidth: 2,
    borderRadius: 999,
    paddingHorizontal: 20,
    fontSize: 16,
  },
  emptySearch: { paddingHorizontal: 16, paddingVertical: 48, textAlign: "center", fontSize: 14 },
})
