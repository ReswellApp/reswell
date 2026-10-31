import { useState } from "react"
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import { reportListing } from "@/lib/api"
import { useAuthGate } from "@/lib/auth-gate"
import { fontFamily, useReswellColors } from "@/theme"

const REASONS = [
  "Scam or fraud",
  "Misleading photos or description",
  "Prohibited item",
  "Harassment or unsafe meetup",
  "Something else",
] as const

export function ReportListingButton({ listingId }: { listingId: string }) {
  const colors = useReswellColors()
  const { requestAuth } = useAuthGate()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<(typeof REASONS)[number] | null>(null)
  const [details, setDetails] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setReason(null)
    setDetails("")
    setError(null)
    setBusy(false)
  }

  function close() {
    setOpen(false)
    reset()
  }

  function submit() {
    if (!reason || busy) return
    requestAuth((token) => {
      setBusy(true)
      setError(null)
      void reportListing(token, listingId, {
        reason,
        ...(details.trim() ? { details: details.trim() } : {}),
      })
        .then(() => {
          close()
          Alert.alert("Report sent", "Thanks — Reswell will review this listing.")
        })
        .catch((cause: unknown) => {
          setError(cause instanceof Error ? cause.message : "Couldn't send that report.")
          setBusy(false)
        })
    })
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Report listing to Reswell"
        onPress={() => requestAuth(() => setOpen(true))}
        style={styles.trigger}
      >
        <Text style={[styles.triggerLabel, { color: colors.muted, fontFamily: fontFamily.text }]}>
          Report listing to Reswell
        </Text>
      </Pressable>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          <Text style={[styles.title, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
            Report listing
          </Text>
          <Text style={[styles.hint, { color: colors.muted, fontFamily: fontFamily.text }]}>
            Tell us what’s wrong. Reports go to Reswell support right away.
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
    </>
  )
}

const styles = StyleSheet.create({
  trigger: { alignSelf: "flex-start", paddingVertical: 8 },
  triggerLabel: { fontSize: 14, textDecorationLine: "underline" },
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
