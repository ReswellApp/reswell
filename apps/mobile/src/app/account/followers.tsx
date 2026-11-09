import { useRouter } from "expo-router"
import { useCallback } from "react"
import { FlatList } from "react-native"
import { AccountState } from "@/components/account-state"
import { SellerFollowRow } from "@/components/seller-follow-row"
import { fetchFollowers } from "@/lib/api"
import { useAccountResource } from "@/lib/use-account-resource"

export default function FollowersScreen() {
  const router = useRouter()
  const load = useCallback((accessToken: string) => fetchFollowers(accessToken), [])
  const { data, error, loading, reload } = useAccountResource(load)
  const sellers = data?.sellers ?? []

  return (
    <AccountState
      title="Followers"
      loading={loading}
      error={error}
      onRetry={reload}
      empty="No followers yet."
      isEmpty={sellers.length === 0}
    >
      <FlatList
        data={sellers}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={reload}
        renderItem={({ item }) => (
          <SellerFollowRow
            seller={item}
            onPressProfile={() => router.push({ pathname: "/profile/[slug]", params: { slug: item.seller_slug } })}
          />
        )}
      />
    </AccountState>
  )
}
