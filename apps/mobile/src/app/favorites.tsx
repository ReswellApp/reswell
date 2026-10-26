import { Stack, useRouter } from "expo-router"
import { useCallback, useState } from "react"
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native"
import { ScreenSearchHeader } from "@/components/screen-search-header"
import { ListingCard } from "@/components/listing-card"
import { fetchFavorites } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useAuthGate } from "@/lib/auth-gate"
import { useAccountResource } from "@/lib/use-account-resource"
import { fontFamily, useReswellColors } from "@/theme"

export default function FavoritesTabScreen() {
  const colors = useReswellColors()
  const { session } = useAuth()
  const { requestAuth } = useAuthGate()
  const signedIn = Boolean(session?.access_token)

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenSearchHeader />
      <View style={[styles.header, { paddingTop: 8 }]}>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: fontFamily.headline }]}>Favorites</Text>
        <Text style={[styles.subtitle, { color: colors.muted, fontFamily: fontFamily.text }]}>
          Listings you've saved.
        </Text>
      </View>
      {signedIn ? (
        <FavoritesList />
      ) : (
        <View style={styles.signedOut}>
          <Text style={[styles.message, { color: colors.muted, fontFamily: fontFamily.text }]}>
            Sign in to see the listings you've saved.
          </Text>
          <Pressable onPress={() => requestAuth()} style={[styles.button, { backgroundColor: colors.primary }]}>
            <Text style={[styles.buttonLabel, { color: colors.primaryForeground, fontFamily: fontFamily.text }]}>
              Sign in
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  )
}

function FavoritesList() {
  const colors = useReswellColors()
  const router = useRouter()
  const load = useCallback((accessToken: string) => fetchFavorites(accessToken), [])
  const { data, error, loading, reload } = useAccountResource(load)
  const favorites = data?.favorites ?? []
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set())
  const visible = favorites.filter((favorite) => !removed.has(favorite.listing.id))
  const grid = visible.length % 2 === 1 ? [...visible, null] : visible

  if (loading && favorites.length === 0) {
    return <ActivityIndicator style={styles.centered} color={colors.foreground} />
  }

  if (error && favorites.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={[styles.message, { color: colors.foreground, fontFamily: fontFamily.text }]}>{error}</Text>
        <Pressable onPress={reload}>
          <Text style={[styles.retry, { color: colors.foreground, fontFamily: fontFamily.text }]}>Try again</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <FlatList
      data={grid}
      keyExtractor={(item) => item?.id ?? "spacer"}
      numColumns={2}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.list}
      refreshing={loading}
      onRefresh={() => {
        setRemoved(new Set())
        reload()
      }}
      ListEmptyComponent={
        <Text style={[styles.message, styles.empty, { color: colors.muted, fontFamily: fontFamily.text }]}>
          No saved listings yet.
        </Text>
      }
      renderItem={({ item }) =>
        item ? (
          <ListingCard
            item={item.listing}
            initialFavorited
            onFavoritedChange={(favorited) => {
              if (favorited) return
              setRemoved((current) => new Set(current).add(item.listing.id))
            }}
            onPress={() =>
              router.push({ pathname: "/listing/[id]", params: { id: item.listing.slug || item.listing.id } })
            }
          />
        ) : (
          <View style={styles.spacer} />
        )
      }
    />
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 8, gap: 6 },
  title: { fontSize: 28, fontWeight: "700" },
  subtitle: { fontSize: 15, lineHeight: 21 },
  signedOut: { flex: 1, justifyContent: "center", paddingHorizontal: 24, gap: 16 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  message: { fontSize: 16, lineHeight: 22, textAlign: "center" },
  empty: { marginTop: 48 },
  button: { borderRadius: 8, minHeight: 48, alignItems: "center", justifyContent: "center" },
  buttonLabel: { fontSize: 16, fontWeight: "600" },
  retry: { fontSize: 16, fontWeight: "600" },
  list: { paddingTop: 8 },
  row: { gap: 12, paddingHorizontal: 12 },
  spacer: { flex: 1 },
})
