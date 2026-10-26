import { useRouter } from "expo-router"
import { useCallback } from "react"
import { FlatList, StyleSheet, Text, View } from "react-native"
import type { MobileBalanceSheet } from "@reswell/api-contract"
import { AccountRow } from "@/components/account-row"
import { AccountState } from "@/components/account-state"
import { fetchBalanceSheet } from "@/lib/api"
import { useAccountResource } from "@/lib/use-account-resource"
import { fontFamily, useReswellColors } from "@/theme"

export default function AccountBalanceSheetScreen() {
  const router = useRouter()
  const load = useCallback((accessToken: string) => fetchBalanceSheet(accessToken), [])
  const { data, error, loading, reload } = useAccountResource(load)

  return (
    <AccountState
      title="Balance Sheet"
      loading={loading && !data}
      error={error}
      onRetry={reload}
      empty="The balance sheet is not available for this account."
      isEmpty={!data}
    >
      {data ? (
        <FlatList
          data={data.entries}
          keyExtractor={(item) => item.id}
          refreshing={loading}
          onRefresh={reload}
          ListHeaderComponent={<Summary sheet={data} />}
          ListEmptyComponent={<EmptySheet />}
          renderItem={({ item }) => (
            <AccountRow
              title={item.title}
              subtitle={[item.section_label, item.order_number].filter(Boolean).join(" · ")}
              meta={item.profit_label ?? item.sold_label}
              onPress={() => router.push({ pathname: "/listing/[id]", params: { id: item.listing_id } })}
            />
          )}
        />
      ) : null}
    </AccountState>
  )
}

function Summary({ sheet }: { sheet: MobileBalanceSheet }) {
  const colors = useReswellColors()
  const lines = [
    ["Inventory", `${sheet.inventory_listings} · ${sheet.inventory_asking_label}`],
    ["Cost basis", sheet.inventory_cost_label],
    ["Realized sales", `${sheet.realized_sales} · ${sheet.gross_sales_label}`],
    ["Fees", sheet.fees_label],
    ["Profit", sheet.realized_profit_label],
  ]
  return (
    <View style={styles.summary}>
      {lines.map(([label, value]) => (
        <Text key={label} style={[styles.line, { color: colors.foreground, fontFamily: fontFamily.text }]}>
          {label}: {value}
        </Text>
      ))}
      {sheet.missing_cost_basis > 0 ? (
        <Text style={[styles.line, { color: colors.muted, fontFamily: fontFamily.text }]}>
          {sheet.missing_cost_basis} listings are missing a purchase price.
        </Text>
      ) : null}
    </View>
  )
}

function EmptySheet() {
  const colors = useReswellColors()
  return <Text style={[styles.empty, { color: colors.muted, fontFamily: fontFamily.text }]}>No balance sheet listings yet.</Text>
}

const styles = StyleSheet.create({
  summary: { padding: 20, gap: 6 },
  line: { fontSize: 16, lineHeight: 22 },
  empty: { textAlign: "center", padding: 24, fontSize: 15 },
})
