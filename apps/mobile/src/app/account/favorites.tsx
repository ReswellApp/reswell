import { useRouter } from "expo-router"
import { useCallback, useState } from "react"
import { FlatList, StyleSheet, View } from "react-native"
import { AccountState } from "@/components/account-state"
import { ListingCard } from "@/components/listing-card"
import { fetchFavorites } from "@/lib/api"
import { useAccountResource } from "@/lib/use-account-resource"

export default function AccountFavoritesScreen() {
  const router = useRouter()
  const load = useCallback((accessToken: string) => fetchFavorites(accessToken), [])
  const { data, error, loading, reload } = useAccountResource(load)
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set())
  const favorites = (data?.favorites ?? []).filter((favorite) => !removed.has(favorite.listing.id))
  const grid = favorites.length % 2 === 1 ? [...favorites, null] : favorites

  return (
    <AccountState
      title="Favorites"
      loading={loading}
      error={error}
      onRetry={reload}
      empty="No saved listings yet."
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
              initialFavorited
              onFavoritedChange={(favorited) => {
                if (!favorited) setRemoved((current) => new Set(current).add(item.listing.id))
              }}
              onPress={() => router.push({ pathname: "/listing/[id]", params: { id: item.listing.slug || item.listing.id } })}
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
  list: { paddingHorizontal: 12, paddingBottom: 120 },
  row: { gap: 12 },
  spacer: { flex: 1 },
})
