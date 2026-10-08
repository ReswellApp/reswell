import { useState } from "react"
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import type { MobileOffer } from "@reswell/api-contract"
import { actOnOffer } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { fontFamily, useReswellColors } from "@/theme"

export function OfferActions({ offer, onDone }: { offer: MobileOffer; onDone: () => void }) {
  const colors = useReswellColors()
  const { session } = useAuth()
  const [counter, setCounter] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const token = session?.access_token

  async function run(action: "accept" | "decline" | "counter" | "withdraw", amount?: number) {
    if (!token || busy) return
    setBusy(true)
    setError(null)
    try {
      await actOnOffer(token, offer.id, {
        action,
        counter_amount: amount,
      })
      onDone()
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not update this offer")
    } finally {
      setBusy(false)
    }
  }

  const seller = offer.role === "received" && offer.status === "PENDING"
  const buyerPending = offer.role === "sent" && offer.status === "PENDING"
  const buyerCounter = offer.role === "sent" && offer.status === "COUNTERED"
  if (!seller && !buyerPending && !buyerCounter) return null

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {seller || buyerCounter ? (
          <Action label="Accept" disabled={busy} onPress={() => void run("accept")} />
        ) : null}
        {seller || buyerCounter ? (
          <Action label="Decline" disabled={busy} onPress={() => void run("decline")} />
        ) : null}
        {buyerPending ? <Action label="Withdraw" disabled={busy} onPress={() => void run("withdraw")} /> : null}
      </View>
      {seller ? (
        <View style={styles.row}>
          <TextInput
            value={counter}
            onChangeText={setCounter}
            keyboardType="decimal-pad"
            placeholder="Counter amount"
            placeholderTextColor={colors.muted}
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, fontFamily: fontFamily.text }]}
          />
          <Action
            label="Counter"
            disabled={busy}
            onPress={() => {
              const amount = Number(counter)
              if (!Number.isFinite(amount) || amount <= 0) {
                setError("Enter a counter amount.")
                return
              }
              void run("counter", amount)
            }}
          />
        </View>
      ) : null}
      {error ? <Text style={[styles.error, { color: colors.destructive, fontFamily: fontFamily.text }]}>{error}</Text> : null}
    </View>
  )
}

function Action({ label, onPress, disabled }: { label: string; onPress: () => void; disabled: boolean }) {
  const colors = useReswellColors()
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={6}>
      <Text style={[styles.action, { color: colors.foreground, fontFamily: fontFamily.text }]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 16 },
  action: { fontSize: 15, fontWeight: "600" },
  input: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 16 },
  error: { fontSize: 14 },
})
