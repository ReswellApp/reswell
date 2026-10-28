import { useCallback } from "react"
import { ScrollView, StyleSheet } from "react-native"
import { useLocalSearchParams } from "expo-router"
import { AccountState } from "@/components/account-state"
import { PurchaseDetailView } from "@/components/purchases/purchase-detail-view"
import { fetchPurchase } from "@/lib/api"
import { useAccountResource } from "@/lib/use-account-resource"

export default function PurchaseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const load = useCallback(
    (token: string) => {
      if (!id) return Promise.reject(new Error("Missing purchase"))
      return fetchPurchase(token, id)
    },
    [id],
  )
  const { data, error, loading, reload } = useAccountResource(load)

  return (
    <AccountState
      title="Purchases"
      loading={loading}
      error={error}
      onRetry={reload}
      empty="Purchase not found."
      isEmpty={!data}
    >
      {data ? (
        <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.scroll}>
          <PurchaseDetailView purchase={data} />
        </ScrollView>
      ) : null}
    </AccountState>
  )
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
})
