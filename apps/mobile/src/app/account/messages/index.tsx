import { useRouter } from "expo-router"
import { FlatList } from "react-native"
import { AccountRow } from "@/components/account-row"
import { AccountState } from "@/components/account-state"
import { fetchConversations } from "@/lib/api"
import { useAccountResource } from "@/lib/use-account-resource"

function when(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export default function MessagesScreen() {
  const router = useRouter()
  const { data, error, loading, reload } = useAccountResource(fetchConversations)
  const conversations = data?.conversations ?? []

  return (
    <AccountState
      title="Messages"
      loading={loading}
      error={error}
      onRetry={reload}
      empty="No messages yet."
      isEmpty={conversations.length === 0}
    >
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={reload}
        renderItem={({ item }) => (
          <AccountRow
            title={item.other_name}
            subtitle={item.preview ?? item.listing_title}
            meta={item.unread_count > 0 ? String(item.unread_count) : when(item.last_message_at)}
            imageUrl={item.other_avatar_url}
            onPress={() => router.push({ pathname: "/account/messages/[id]", params: { id: item.id } })}
          />
        )}
      />
    </AccountState>
  )
}
