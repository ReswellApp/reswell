import { useState } from "react"
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import { reportUser } from "@/lib/api"
import { fontFamily, useReswellColors } from "@/theme"

const REASONS = [
  "Scam or fraud",
  "Harassment",
  "Off-platform payment pressure",
  "Unsafe meetup",
  "Something else",
] as const

export function ReportUserSheet({
  presented,
  onDismiss,
  accessToken,
  reportedUserId,
  conversationId,
  onBlocked,
}: {
  presented: boolean
  onDismiss: () => void
  accessToken: string
  reportedUserId: string
  conversationId: string
  onBlocked?: () => void
}) {
  const colors = useReswellColors()
  const [reason, setReason] = useState<(typeof REASONS)[number] | null>(null)
  const [details, setDetails] = useState("")
  const [alsoBlock, setAlsoBlock] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function close() {
    onDismiss()
    setReason(null)
    setDetails("")
    setAlsoBlock(true)
    setError(null)
    setBusy(false)
  }

  function submit() {
    if (!reason || busy) return
    setBusy(true)
    setError(null)
    void reportUser(accessToken, {
      reported_user_id: reportedUserId,
      reason,
      conversation_id: conversationId,
      block: alsoBlock,
      ...(details.trim() ? { details: details.trim() } : {}),
    })
      .then((result) => {
        close()
        if (result.blocked) onBlocked?.()
        Alert.alert(
          result.blocked ? "Reported and blocked" : "Report sent",
          result.blocked
            ? "Thanks. This member is blocked and Reswell will review your report."
            : "Thanks — Reswell will review this report.",
        )
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Couldn't send that report.")
        setBusy(false)
      })
  }

  return (
    <Modal visible={presented} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <View style={[styles.sheet, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
          Report member
        </Text>
        <Text style={[styles.hint, { color: colors.muted, fontFamily: fontFamily.text }]}>
          Reports create an urgent safety case for Reswell support.
        </Text>

        <View style={styles.reasons}>
          {REASONS.map((item) => {
            const selected = reason === item
            return (
              <Pressable
                key={item}
                onPress={() => setReason(item)}
                style={[
                  styles.reason,
                  {
                    borderColor: selected ? colors.foreground : colors.border,
                    backgroundColor: selected ? colors.secondary : colors.background,
                  },
                ]}
              >
                <Text style={[styles.reasonLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                  {item}
                </Text>
              </Pressable>
            )
          })}
        </View>

        <TextInput
          value={details}
          onChangeText={setDetails}
          placeholder="Optional details"
          placeholderTextColor={colors.muted}
          multiline
          style={[
            styles.details,
            {
              color: colors.foreground,
              borderColor: colors.border,
              backgroundColor: colors.background,
              fontFamily: fontFamily.text,
            },
          ]}
        />

        <Pressable onPress={() => setAlsoBlock((value) => !value)} style={styles.blockRow}>
          <View
            style={[
              styles.checkbox,
              {
                borderColor: colors.border,
                backgroundColor: alsoBlock ? colors.foreground : colors.background,
              },
            ]}
          />
          <Text style={[styles.blockLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>
            Also block this member
          </Text>
        </Pressable>

        {error ? (
          <Text style={[styles.error, { color: colors.destructive, fontFamily: fontFamily.text }]}>{error}</Text>
        ) : null}

        <Pressable
          disabled={!reason || busy}
          onPress={submit}
          style={[styles.primary, { backgroundColor: colors.foreground, opacity: !reason || busy ? 0.4 : 1 }]}
        >
          {busy ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={[styles.primaryLabel, { color: colors.background, fontFamily: fontFamily.text }]}>
              Submit report
            </Text>
          )}
        </Pressable>

        <Pressable onPress={close} style={styles.cancel}>
          <Text style={[styles.cancelLabel, { color: colors.muted, fontFamily: fontFamily.text }]}>Cancel</Text>
        </Pressable>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  sheet: { flex: 1, paddingHorizontal: 20, paddingTop: 24, gap: 14 },
  title: { fontSize: 24, fontWeight: "700", letterSpacing: -0.4 },
  hint: { fontSize: 15, lineHeight: 22 },
  reasons: { gap: 8 },
  reason: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  reasonLabel: { fontSize: 15, fontWeight: "600" },
  details: {
    minHeight: 96,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    textAlignVertical: "top",
  },
  blockRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: StyleSheet.hairlineWidth },
  blockLabel: { fontSize: 15, fontWeight: "600" },
  error: { fontSize: 14 },
  primary: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryLabel: { fontSize: 16, fontWeight: "700" },
  cancel: { alignItems: "center", paddingVertical: 10 },
  cancelLabel: { fontSize: 15 },
})
