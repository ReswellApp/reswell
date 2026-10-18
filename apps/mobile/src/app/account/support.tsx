import { useRouter } from "expo-router"
import { useCallback } from "react"
import { FlatList } from "react-native"
import { AccountRow } from "@/components/account-row"
import { AccountState } from "@/components/account-state"
import { fetchSupportCases } from "@/lib/api"
import { useAccountResource } from "@/lib/use-account-resource"

export default function AccountSupportScreen() {
  const router = useRouter()
  const load = useCallback((accessToken: string) => fetchSupportCases(accessToken), [])
  const { data, error, loading, reload } = useAccountResource(load)
  const cases = data?.cases ?? []

  return (
    <AccountState
      title="Support"
      loading={loading}
      error={error}
      onRetry={reload}
      empty="No support cases yet."
      isEmpty={cases.length === 0}
    >
      <FlatList
        data={cases}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={reload}
        renderItem={({ item }) => (
          <AccountRow
            title={item.subject}
            subtitle={[item.status_label, item.order_ref, item.preview].filter(Boolean).join(" · ")}
            meta={item.unread_count > 0 ? String(item.unread_count) : null}
            onPress={() => router.push({ pathname: "/account/support/[id]", params: { id: item.id } })}
          />
        )}
      />
    </AccountState>
  )
}
