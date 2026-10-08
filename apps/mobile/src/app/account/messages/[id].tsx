import { Stack, useLocalSearchParams } from "expo-router"
import { useCallback, useState } from "react"
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import { AccountState } from "@/components/account-state"
import { fetchConversation, sendConversationMessage } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useAccountResource } from "@/lib/use-account-resource"
import { fontFamily, useReswellColors } from "@/theme"

export default function ConversationScreen() {
  const colors = useReswellColors()
  const { session } = useAuth()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [draft, setDraft] = useState("")
  const [sendError, setSendError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const load = useCallback(
    (token: string) => {
      if (!id) return Promise.reject(new Error("Missing conversation"))
      return fetchConversation(id, token)
    },
    [id],
  )
  const { data, error, loading, reload } = useAccountResource(load)
  const messages = data?.messages ?? []

  return (
    <AccountState
      title={data?.other_name ?? "Messages"}
      loading={loading}
      error={error}
      onRetry={reload}
      empty="No messages in this conversation."
      isEmpty={messages.length === 0}
    >
      <Stack.Screen options={{ title: data?.listing_title ?? data?.other_name ?? "Messages" }} />
      <View style={styles.thread}>
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshing={loading}
        onRefresh={reload}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.mine ? styles.mine : styles.theirs]}>
            <Text
              style={[
                styles.body,
                {
                  color: item.mine ? colors.primaryForeground : colors.foreground,
                  backgroundColor: item.mine ? colors.primary : colors.image,
                  fontFamily: fontFamily.text,
                },
              ]}
            >
              {item.body}
            </Text>
          </View>
        )}
      />
      <View style={[styles.composer, { borderColor: colors.border }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Message"
          placeholderTextColor={colors.muted}
          style={[styles.input, { color: colors.foreground, fontFamily: fontFamily.text }]}
        />
        <Pressable
          disabled={sending}
          onPress={() => {
            const token = session?.access_token
            const body = draft.trim()
            if (!token || !id || !body) return
            setSending(true)
            setSendError(null)
            sendConversationMessage(token, id, body)
              .then(() => {
                setDraft("")
                reload()
              })
              .catch((cause: unknown) => {
                setSendError(cause instanceof Error ? cause.message : "Could not send that message")
              })
              .finally(() => setSending(false))
          }}
        >
          <Text style={[styles.send, { color: colors.foreground, fontFamily: fontFamily.text }]}>
            {sending ? "Sending" : "Send"}
          </Text>
        </Pressable>
      </View>
      {sendError ? (
        <Text style={[styles.sendError, { color: colors.destructive, fontFamily: fontFamily.text }]}>{sendError}</Text>
      ) : null}
      </View>
    </AccountState>
  )
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 8 },
  bubble: { maxWidth: "80%" },
  mine: { alignSelf: "flex-end" },
  theirs: { alignSelf: "flex-start" },
  body: { fontSize: 16, lineHeight: 22, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, overflow: "hidden" },
  thread: { flex: 1 },
  composer: { flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: StyleSheet.hairlineWidth, padding: 12 },
  input: { flex: 1, fontSize: 16, paddingVertical: 8 },
  send: { fontSize: 16, fontWeight: "600" },
  sendError: { paddingHorizontal: 16, paddingBottom: 8, fontSize: 14 },
})
