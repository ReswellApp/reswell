import { useRouter } from "expo-router"
import { FlatList, View } from "react-native"
import { AccountRow } from "@/components/account-row"
import { AccountState } from "@/components/account-state"
import { OfferActions } from "@/components/offer-actions"
import { fetchOffers } from "@/lib/api"
import { useAccountResource } from "@/lib/use-account-resource"

export default function OffersScreen() {
  const router = useRouter()
  const { data, error, loading, reload } = useAccountResource(fetchOffers)
  const offers = data?.offers ?? []

  return (
    <AccountState
      title="Offers"
      loading={loading}
      error={error}
      onRetry={reload}
      empty="No offers yet."
      isEmpty={offers.length === 0}
    >
      <FlatList
        data={offers}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={reload}
        renderItem={({ item }) => (
          <View>
            <AccountRow
              title={item.listing_title}
              subtitle={`${item.role === "sent" ? "Sent" : "Received"} · ${item.status} · ${item.counterparty_name}`}
              meta={item.amount_label}
              imageUrl={item.listing_image_url}
              onPress={() => router.push({ pathname: "/listing/[id]", params: { id: item.listing_id } })}
            />
            <OfferActions offer={item} onDone={reload} />
          </View>
        )}
      />
    </AccountState>
  )
}
