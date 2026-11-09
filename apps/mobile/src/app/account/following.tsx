import { useRouter } from "expo-router"
import { useCallback, useState } from "react"
import { FlatList } from "react-native"
import { AccountState } from "@/components/account-state"
import { SellerFollowRow } from "@/components/seller-follow-row"
import { fetchFollowing, setFollow } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useAccountResource } from "@/lib/use-account-resource"

export default function FollowingScreen() {
  const router = useRouter()
  const { session } = useAuth()
  const load = useCallback((accessToken: string) => fetchFollowing(accessToken), [])
  const { data, error, loading, reload } = useAccountResource(load)
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
          <SellerFollowRow
            seller={item}
            onPressProfile={() => router.push({ pathname: "/profile/[slug]", params: { slug: item.seller_slug } })}
            onUnfollow={() => {
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
          />
        )}
      />
    </AccountState>
  )
}
