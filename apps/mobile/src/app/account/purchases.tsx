import { FlatList } from "react-native"
import { AccountState } from "@/components/account-state"
import { OrderAccountCard } from "@/components/order-account-card"
import { fetchPurchases } from "@/lib/api"
import { useAccountResource } from "@/lib/use-account-resource"

export default function PurchasesScreen() {
  const { data, error, loading, reload } = useAccountResource(fetchPurchases)
  const orders = data?.orders ?? []

  return (
    <AccountState title="Purchases" loading={loading} error={error} onRetry={reload} empty="No purchases yet." isEmpty={orders.length === 0}>
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={reload}
        renderItem={({ item }) => <OrderAccountCard order={item} />}
      />
    </AccountState>
  )
}
