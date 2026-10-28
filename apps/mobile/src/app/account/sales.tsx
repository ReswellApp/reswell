import { useMemo, useState } from "react"
import { FlatList, StyleSheet, Text, TextInput, View } from "react-native"
import { AccountState } from "@/components/account-state"
import { SaleOrderRow } from "@/components/sales/sale-order-row"
import { SalesFulfillmentFilters } from "@/components/sales/sales-fulfillment-filters"
import { fetchSales } from "@/lib/api"
import {
  saleCountLabel,
  saleMatchesFilter,
  saleMatchesQuery,
  salesFilterEmptyMessage,
  type SalesListFilter,
} from "@/lib/sale-display"
import { useAccountResource } from "@/lib/use-account-resource"
import { fontFamily, useReswellColors } from "@/theme"

export default function SalesScreen() {
  const colors = useReswellColors()
  const { data, error, loading, reload } = useAccountResource(fetchSales)
  const sales = data?.sales ?? []
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<SalesListFilter>("all")
  const pendingShipmentCount = useMemo(
    () => sales.filter((item) => item.pending_kind === "shipment").length,
    [sales],
  )
  const pendingPickupCount = useMemo(
    () => sales.filter((item) => item.pending_kind === "pickup").length,
    [sales],
  )
  const filtered = useMemo(
    () => sales.filter((item) => saleMatchesFilter(item, filter)),
    [sales, filter],
  )
  const visible = useMemo(
    () => filtered.filter((item) => saleMatchesQuery(item, query)),
    [filtered, query],
  )
  const searching = query.trim().length > 0
  const countLabel = saleCountLabel(searching ? visible.length : filtered.length)
  const showGroups = filter === "all"

  return (
    <AccountState
      title="Sales"
      loading={loading}
      error={error}
      onRetry={reload}
      empty="When someone buys your gear, the sale shows up here with fulfillment details."
      isEmpty={sales.length === 0}
    >
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={reload}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="never"
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.subtitle, { color: colors.muted, fontFamily: fontFamily.text }]}>
              Track and fulfill your orders.
            </Text>
            <Text style={[styles.count, { color: colors.muted, fontFamily: fontFamily.text }]}>{countLabel}</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="title, buyer or order #"
              placeholderTextColor={colors.muted}
              accessibilityLabel="Search sales by title, buyer, or order number"
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
            <SalesFulfillmentFilters
              activeFilter={filter}
              pendingShipmentCount={pendingShipmentCount}
              pendingPickupCount={pendingPickupCount}
              onChange={setFilter}
            />
          </View>
        }
        ListEmptyComponent={
          searching ? (
            <Text style={[styles.emptySearch, { color: colors.muted, fontFamily: fontFamily.text }]}>
              No sales match that search.
            </Text>
          ) : (
            <Text style={[styles.emptySearch, { color: colors.muted, fontFamily: fontFamily.text }]}>
              {salesFilterEmptyMessage(filter)}
            </Text>
          )
        }
        renderItem={({ item, index }) => {
          const previous = index > 0 ? visible[index - 1] : undefined
          const showOpenHeading = showGroups && item.needs_fulfillment && index === 0
          const showEarlierHeading =
            showGroups && !item.needs_fulfillment && (index === 0 || Boolean(previous?.needs_fulfillment))
          return (
            <View>
              {showOpenHeading ? (
                <Text style={[styles.group, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                  Needs fulfillment
                </Text>
              ) : null}
              {showEarlierHeading ? (
                <Text style={[styles.groupMuted, { color: colors.muted, fontFamily: fontFamily.text }]}>
                  Earlier sales
                </Text>
              ) : null}
              <SaleOrderRow item={item} />
            </View>
          )
        }}
      />
    </AccountState>
  )
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, gap: 16 },
  subtitle: { fontSize: 15, lineHeight: 20 },
  count: { fontSize: 22, fontWeight: "500", lineHeight: 26 },
  search: {
    height: 48,
    borderWidth: 2,
    borderRadius: 999,
    paddingHorizontal: 20,
    fontSize: 16,
  },
  emptySearch: { paddingHorizontal: 16, paddingVertical: 48, textAlign: "center", fontSize: 14 },
  group: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, fontSize: 14, fontWeight: "700" },
  groupMuted: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4, fontSize: 14, fontWeight: "700" },
})
