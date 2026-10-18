import { useRouter } from "expo-router"
import { useState } from "react"
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native"
import { AccountRow } from "@/components/account-row"
import { AccountState } from "@/components/account-state"
import { OfferActions } from "@/components/offer-actions"
import { fetchOffers } from "@/lib/api"
import { useAccountResource } from "@/lib/use-account-resource"
import { fontFamily, useReswellColors } from "@/theme"

export default function OffersScreen() {
  const router = useRouter()
  const { data, error, loading, reload } = useAccountResource(fetchOffers)
  const colors = useReswellColors()
  const [role, setRole] = useState<"all" | "received" | "sent">("all")
  const allOffers = data?.offers ?? []
  const offers = allOffers.filter((offer) => role === "all" || offer.role === role)

  return (
    <AccountState
      title="Offers"
      loading={loading}
      error={error}
      onRetry={reload}
      empty="No offers yet."
      isEmpty={allOffers.length === 0}
    >
      <FlatList
        data={offers}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={reload}
        ListHeaderComponent={
          <View style={styles.filters}>
            {(["all", "received", "sent"] as const).map((item) => {
              const active = role === item
              return (
                <Pressable key={item} onPress={() => setRole(item)} style={[styles.filter, { backgroundColor: active ? colors.foreground : colors.image }]}>
                  <Text style={[styles.filterLabel, { color: active ? colors.background : colors.foreground, fontFamily: fontFamily.text }]}>
                    {item === "all" ? "All" : item === "received" ? "Received" : "Sent"}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        }
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

const styles = StyleSheet.create({
  filters: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  filter: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  filterLabel: { fontSize: 13, fontWeight: "700" },
})
