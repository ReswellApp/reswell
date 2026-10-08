import { useRouter } from "expo-router"
import { FlatList } from "react-native"
import { AccountRow } from "@/components/account-row"
import { AccountState } from "@/components/account-state"
import { fetchFollowing } from "@/lib/api"
import { useAccountResource } from "@/lib/use-account-resource"

export default function FollowingScreen() {
  const router = useRouter()
  const { data, error, loading, reload } = useAccountResource(fetchFollowing)
  const sellers = data?.sellers ?? []

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
          <AccountRow
            title={item.name}
            subtitle={item.city}
            imageUrl={item.avatar_url}
            onPress={() => router.push({ pathname: "/profile/[slug]", params: { slug: item.seller_slug } })}
          />
        )}
      />
    </AccountState>
  )
}
