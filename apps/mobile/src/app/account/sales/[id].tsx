import { useCallback } from "react"
import { ScrollView, StyleSheet } from "react-native"
import { useLocalSearchParams } from "expo-router"
import { AccountState } from "@/components/account-state"
import { SaleDetailView } from "@/components/sales/sale-detail-view"
import { fetchSale } from "@/lib/api"
import { useAccountResource } from "@/lib/use-account-resource"

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
      title="Sales"
      loading={loading}
      error={error}
      onRetry={reload}
      empty="Sale not found."
      isEmpty={!data}
    >
      {data ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.scroll}
        >
          <SaleDetailView sale={data} onVerified={reload} />
        </ScrollView>
      ) : null}
    </AccountState>
  )
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
})
