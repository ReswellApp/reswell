import { Stack, useLocalSearchParams } from "expo-router"
import { useCallback, useState } from "react"
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import { AccountState } from "@/components/account-state"
import { fetchSupportThread, replySupportCase } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useAccountResource } from "@/lib/use-account-resource"
import { fontFamily, useReswellColors } from "@/theme"

export default function SupportThreadScreen() {
  const colors = useReswellColors()
  const { session } = useAuth()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [draft, setDraft] = useState("")
  const [sendError, setSendError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const load = useCallback(
    (token: string) => {
      if (!id) return Promise.reject(new Error("Missing case"))
      return fetchSupportThread(token, id)
    },
    [id],
  )
  const { data, error, loading, reload } = useAccountResource(load)
  const messages = data?.messages ?? []

  return (
    <AccountState
      title={data?.subject ?? "Support"}
      loading={loading}
      error={error}
      onRetry={reload}
      empty="No messages in this case yet."
      isEmpty={messages.length === 0 && !data}
    >
      <Stack.Screen options={{ title: data?.subject ?? "Support" }} />
      <View style={styles.thread}>
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshing={loading}
          onRefresh={reload}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.muted, fontFamily: fontFamily.text }]}>No messages yet. Send one below.</Text>
          }
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
        {data?.closed ? (
          <Text style={[styles.closed, { color: colors.muted, fontFamily: fontFamily.text }]}>This case is closed.</Text>
        ) : (
          <View style={[styles.composer, { borderColor: colors.border }]}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Message support"
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
                replySupportCase(token, id, body)
                  .then(() => {
                    setDraft("")
                    reload()
                  })
                  .catch((cause: unknown) => {
                    setSendError(cause instanceof Error ? cause.message : "Unable to send")
                  })
                  .finally(() => setSending(false))
              }}
            >
              <Text style={[styles.send, { color: colors.foreground, fontFamily: fontFamily.text }]}>Send</Text>
            </Pressable>
          </View>
        )}
        {sendError ? <Text style={[styles.closed, { color: colors.destructive, fontFamily: fontFamily.text }]}>{sendError}</Text> : null}
      </View>
    </AccountState>
  )
}

const styles = StyleSheet.create({
  thread: { flex: 1 },
  list: { padding: 16, gap: 10, paddingBottom: 24 },
  bubble: { maxWidth: "85%" },
  mine: { alignSelf: "flex-end" },
  theirs: { alignSelf: "flex-start" },
  body: { overflow: "hidden", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, lineHeight: 22 },
  empty: { textAlign: "center", marginTop: 24, fontSize: 15 },
  composer: { flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: StyleSheet.hairlineWidth, padding: 12 },
  input: { flex: 1, fontSize: 16, minHeight: 40 },
  send: { fontSize: 16, fontWeight: "700" },
  closed: { textAlign: "center", padding: 16, fontSize: 15 },
})
