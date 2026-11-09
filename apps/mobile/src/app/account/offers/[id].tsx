import { useCallback } from "react"
import { ScrollView, StyleSheet } from "react-native"
import { useLocalSearchParams } from "expo-router"
import { AccountState } from "@/components/account-state"
import { OfferListRow } from "@/components/offers/offer-list-row"
import { fetchOffer } from "@/lib/api"
import { useAccountResource } from "@/lib/use-account-resource"

export default function OfferDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const load = useCallback(
    (token: string) => {
      if (!id) return Promise.reject(new Error("Missing offer"))
      return fetchOffer(token, id)
    },
    [id],
  )
  const { data, error, loading, reload } = useAccountResource(load)

  return (
    <AccountState
      title="Offer"
      loading={loading}
      error={error}
      onRetry={reload}
      empty="Offer not found."
      isEmpty={!data}
    >
      {data ? (
        <ScrollView contentInsetAdjustmentBehavior="never" contentContainerStyle={styles.scroll}>
          <OfferListRow item={data.offer} onReload={reload} />
        </ScrollView>
      ) : null}
    </AccountState>
  )
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
})
