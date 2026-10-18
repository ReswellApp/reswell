import { useRouter } from "expo-router"
import { FlatList } from "react-native"
import { AccountState } from "@/components/account-state"
import { OrderAccountCard } from "@/components/order-account-card"
import { fetchSales } from "@/lib/api"
import { useAccountResource } from "@/lib/use-account-resource"

export default function SalesScreen() {
  const router = useRouter()
  const { data, error, loading, reload } = useAccountResource(fetchSales)
  const sales = data?.sales ?? []

  return (
    <AccountState title="Sales" loading={loading} error={error} onRetry={reload} empty="No sales yet." isEmpty={sales.length === 0}>
      <FlatList
        data={sales}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={reload}
        renderItem={({ item }) => (
          <OrderAccountCard
            order={item}
            earnings={item.seller_earnings_label}
            onOpen={() => router.push({ pathname: "/account/sales/[id]", params: { id: item.id } })}
          />
        )}
      />
    </AccountState>
  )
}
