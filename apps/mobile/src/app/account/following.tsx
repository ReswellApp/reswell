import { useRouter } from "expo-router"
import { useState } from "react"
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native"
import { AccountRow } from "@/components/account-row"
import { AccountState } from "@/components/account-state"
import { fetchFollowing, setFollow } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useAccountResource } from "@/lib/use-account-resource"
import { fontFamily, useReswellColors } from "@/theme"

export default function FollowingScreen() {
  const colors = useReswellColors()
  const router = useRouter()
  const { session } = useAuth()
  const { data, error, loading, reload } = useAccountResource(fetchFollowing)
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set())
  const sellers = (data?.sellers ?? []).filter((seller) => !hidden.has(seller.id))

  return (
    <AccountState
      title="Following"
      loading={loading}
      error={error}
      onRetry={reload}
      empty="You are not following anyone yet."
      isEmpty={sellers.length === 0}
    >
      <FlatList
        data={sellers}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={reload}
        renderItem={({ item }) => (
          <View>
          <AccountRow
            title={item.name}
            subtitle={item.city}
            imageUrl={item.avatar_url}
            onPress={() => router.push({ pathname: "/profile/[slug]", params: { slug: item.seller_slug } })}
          />
          <View style={styles.actions}>
            <Pressable
              onPress={() => router.push({ pathname: "/profile/[slug]", params: { slug: item.seller_slug } })}
              style={[styles.button, { backgroundColor: colors.image }]}
            >
              <Text style={[styles.label, { color: colors.foreground, fontFamily: fontFamily.text }]}>View shop</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                const token = session?.access_token
                if (!token) return
                setHidden((current) => new Set(current).add(item.id))
                void setFollow(token, item.id, false).catch(() => {
                  setHidden((current) => {
                    const next = new Set(current)
                    next.delete(item.id)
                    return next
                  })
                })
              }}
              style={[styles.button, { backgroundColor: colors.image }]}
            >
              <Text style={[styles.label, { color: colors.foreground, fontFamily: fontFamily.text }]}>Unfollow</Text>
            </Pressable>
          </View>
          </View>
        )}
      />
    </AccountState>
  )
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  button: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  label: { fontSize: 13, fontWeight: "700" },
})
