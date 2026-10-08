import { useRouter } from "expo-router"
import { FlatList } from "react-native"
import { AccountRow } from "@/components/account-row"
import { AccountState } from "@/components/account-state"
import { fetchPurchases } from "@/lib/api"
import { useAccountResource } from "@/lib/use-account-resource"

export default function PurchasesScreen() {
  const router = useRouter()
  const { data, error, loading, reload } = useAccountResource(fetchPurchases)
  const orders = data?.orders ?? []

  return (
    <AccountState
      title="Purchases"
      loading={loading}
      error={error}
      onRetry={reload}
      empty="No purchases yet."
      isEmpty={orders.length === 0}
    >
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={reload}
        renderItem={({ item }) => (
          <AccountRow
            title={item.listing_title}
            subtitle={`${item.order_number} · ${item.status_label} · ${item.counterparty_name}`}
            meta={item.amount_label}
            imageUrl={item.listing_image_url}
            onPress={
              item.listing_id
                ? () => {
                    const listingId = item.listing_id
                    if (listingId) router.push({ pathname: "/listing/[id]", params: { id: listingId } })
                  }
                : undefined
            }
          />
        )}
      />
    </AccountState>
  )
}
