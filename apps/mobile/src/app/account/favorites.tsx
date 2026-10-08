import { useRouter } from "expo-router"
import { FlatList, StyleSheet, View } from "react-native"
import { AccountState } from "@/components/account-state"
import { ListingCard } from "@/components/listing-card"
import { fetchFavorites } from "@/lib/api"
import { useAccountResource } from "@/lib/use-account-resource"

export default function FavoritesScreen() {
  const router = useRouter()
  const { data, error, loading, reload } = useAccountResource(fetchFavorites)
  const favorites = data?.favorites ?? []
  const grid = favorites.length % 2 === 1 ? [...favorites, null] : favorites

  return (
    <AccountState
      title="Favorites"
      loading={loading}
      error={error}
      onRetry={reload}
      empty="No saved listings."
      isEmpty={favorites.length === 0}
    >
      <FlatList
        data={grid}
        keyExtractor={(item) => item?.id ?? "spacer"}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        refreshing={loading}
        onRefresh={reload}
        renderItem={({ item }) =>
          item ? (
            <ListingCard
              item={item.listing}
              onPress={() =>
                router.push({ pathname: "/listing/[id]", params: { id: item.listing.slug || item.listing.id } })
              }
            />
          ) : (
            <View style={styles.spacer} />
          )
        }
      />
    </AccountState>
  )
}

const styles = StyleSheet.create({
  list: { paddingTop: 12, paddingBottom: 28 },
  row: { gap: 12, paddingHorizontal: 12 },
  spacer: { flex: 1 },
})
