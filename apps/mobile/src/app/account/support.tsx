import { useRouter } from "expo-router"
import { useCallback, useState } from "react"
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import { AccountRow } from "@/components/account-row"
import { AccountState } from "@/components/account-state"
import { fetchSupportCases, openSupportCase } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useAccountResource } from "@/lib/use-account-resource"
import { fontFamily, useReswellColors } from "@/theme"

export default function AccountSupportScreen() {
  const colors = useReswellColors()
  const router = useRouter()
  const { session } = useAuth()
  const load = useCallback((accessToken: string) => fetchSupportCases(accessToken), [])
  const { data, error, loading, reload } = useAccountResource(load)
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [sending, setSending] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const cases = data?.cases ?? []

  return (
    <AccountState
      title="Support"
      loading={loading}
      error={error}
      onRetry={reload}
      empty="No support cases yet."
      isEmpty={!data}
    >
      <FlatList
        data={cases}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={reload}
        ListHeaderComponent={
          <View style={styles.form}>
            <Text style={[styles.heading, { color: colors.foreground, fontFamily: fontFamily.headline }]}>New case</Text>
            <TextInput
              value={subject}
              onChangeText={setSubject}
              placeholder="Subject"
              placeholderTextColor={colors.muted}
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, fontFamily: fontFamily.text }]}
            />
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder="How can we help?"
              placeholderTextColor={colors.muted}
              multiline
              style={[styles.input, styles.message, { color: colors.foreground, borderColor: colors.border, fontFamily: fontFamily.text }]}
            />
            {formError ? <Text style={[styles.error, { color: colors.destructive, fontFamily: fontFamily.text }]}>{formError}</Text> : null}
            <Pressable
              disabled={sending}
              onPress={() => {
                const token = session?.access_token
                if (!token || sending) return
                setSending(true)
                setFormError(null)
                void openSupportCase(token, { subject, body })
                  .then((result) => {
                    setSubject("")
                    setBody("")
                    reload()
                    router.push({ pathname: "/account/support/[id]", params: { id: result.id } })
                  })
                  .catch((cause: unknown) => setFormError(cause instanceof Error ? cause.message : "Unable to open a case"))
                  .finally(() => setSending(false))
              }}
              style={[styles.send, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.sendLabel, { color: colors.primaryForeground, fontFamily: fontFamily.text }]}>
                {sending ? "Sending…" : "Contact support"}
              </Text>
            </Pressable>
            {cases.length === 0 && !loading ? (
              <Text style={[styles.error, { color: colors.muted, fontFamily: fontFamily.text }]}>No support cases yet.</Text>
            ) : null}
          </View>
        }
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

const styles = StyleSheet.create({
  form: { padding: 16, gap: 10 },
  heading: { fontSize: 20, fontWeight: "700" },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16 },
  message: { minHeight: 96, textAlignVertical: "top" },
  send: { borderRadius: 14, minHeight: 46, alignItems: "center", justifyContent: "center" },
  sendLabel: { fontSize: 16, fontWeight: "700" },
  error: { fontSize: 14 },
})
