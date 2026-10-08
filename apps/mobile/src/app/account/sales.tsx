import { useRouter } from "expo-router"
import { FlatList } from "react-native"
import { AccountRow } from "@/components/account-row"
import { AccountState } from "@/components/account-state"
import { fetchSales } from "@/lib/api"
import { useAccountResource } from "@/lib/use-account-resource"

export default function SalesScreen() {
  const router = useRouter()
  const { data, error, loading, reload } = useAccountResource(fetchSales)
  const sales = data?.sales ?? []

  return (
    <AccountState
      title="Sales"
      loading={loading}
      error={error}
      onRetry={reload}
      empty="No sales yet."
      isEmpty={sales.length === 0}
    >
      <FlatList
        data={sales}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={reload}
        renderItem={({ item }) => (
          <AccountRow
            title={item.listing_title}
            subtitle={`${item.order_number} · ${item.status_label} · You earn ${item.seller_earnings_label}`}
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
