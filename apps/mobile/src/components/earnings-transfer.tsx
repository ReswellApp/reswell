import { SymbolView } from "expo-symbols"
import { useEffect, useState } from "react"
import { AppState, Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import type { MobileEarnings } from "@reswell/api-contract"
import { cashOutEarnings, startAddBank, startPayoutOnboarding } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { fontFamily, useReswellColors } from "@/theme"

export function EarningsTransfer({
  data,
  onDone,
  onReload,
}: {
  data: MobileEarnings
  onDone: () => void
  onReload: () => void
}) {
  const colors = useReswellColors()
  const { session } = useAuth()
  const [amount, setAmount] = useState(data.ready_usd >= data.minimum_usd ? data.ready_usd.toFixed(2) : "")
  const [speed, setSpeed] = useState<"standard" | "instant">("standard")
  const [bankId, setBankId] = useState(data.banks.find((bank) => bank.default)?.id ?? data.banks[0]?.id ?? "")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<{ amount: string; remaining: string } | null>(null)
  const [waitingOnStripe, setWaitingOnStripe] = useState(false)

  useEffect(() => {
    setAmount(data.ready_usd >= data.minimum_usd ? data.ready_usd.toFixed(2) : "")
    setBankId(data.banks.find((bank) => bank.default)?.id ?? data.banks[0]?.id ?? "")
  }, [data.ready_usd, data.minimum_usd, data.banks])

  useEffect(() => {
    if (!waitingOnStripe) return
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return
      setWaitingOnStripe(false)
      onReload()
    })
    return () => sub.remove()
  }, [onReload, waitingOnStripe])

  const parsed = Number(amount)
  const feeRate = data.instant_fee_rate
  const instantFee = speed === "instant" && Number.isFinite(parsed) ? Math.round(parsed * feeRate * 100) / 100 : 0
  const arrives = Math.max(0, parsed - instantFee)
  const feePercent = feeRate * 100
  const feeLabel = `${Number.isInteger(feePercent) ? feePercent.toFixed(0) : feePercent.toFixed(1)}%`
  const selectedBank = data.banks.find((bank) => bank.id === bankId) ?? data.banks[0]
  const canSend =
    data.cash_out_ready &&
    !busy &&
    Number.isFinite(parsed) &&
    parsed >= data.minimum_usd &&
    parsed <= data.ready_usd + 0.001

  async function openStripe(kind: "connect" | "add") {
    const token = session?.access_token
    if (!token || busy) return
    setBusy(true)
    setError(null)
    try {
      const link = kind === "connect" ? await startPayoutOnboarding(token) : await startAddBank(token)
      setWaitingOnStripe(true)
      await Linking.openURL(link.url)
    } catch (cause: unknown) {
      setWaitingOnStripe(false)
      setError(cause instanceof Error ? cause.message : "Could not open bank setup")
    } finally {
      setBusy(false)
    }
  }

  async function transfer() {
    const token = session?.access_token
    if (!token || !canSend) return
    setBusy(true)
    setError(null)
    try {
      const result = await cashOutEarnings(token, {
        amount: parsed,
        speed,
        externalAccountId: bankId.startsWith("ba_") ? bankId : undefined,
      })
      setSent({ amount: result.amount_label, remaining: result.available_label })
      onReload()
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Transfer failed")
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <View style={styles.page}>
        <View style={[styles.successMark, { backgroundColor: colors.listingHeart }]}>
          <SymbolView name={{ ios: "checkmark", android: "check", web: "check" }} size={28} tintColor="#FFFFFF" />
        </View>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: fontFamily.headline }]}>Transfer sent</Text>
        <Text style={[styles.lead, { color: colors.muted, fontFamily: fontFamily.text }]}>
          {sent.amount} is on its way{selectedBank ? ` to ${selectedBank.label}` : ""}. Your ready balance is {sent.remaining}.
        </Text>
        <Pressable accessibilityRole="button" onPress={onDone} style={[styles.primary, { backgroundColor: colors.sellerProfileBannerDefault }]}>
          <Text style={[styles.primaryLabel, { color: "#FFFFFF", fontFamily: fontFamily.text }]}>Done</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={styles.page}>
      <Text style={[styles.eyebrow, { color: colors.listingHeart, fontFamily: fontFamily.text }]}>Ready to transfer</Text>
      <Text style={[styles.amount, { color: colors.foreground, fontFamily: fontFamily.headline }]}>{data.ready_label}</Text>
      <Text style={[styles.lead, { color: colors.muted, fontFamily: fontFamily.text }]}>
        Minimum transfer is ${data.minimum_usd.toFixed(2)}. Bank details are entered in Stripe, not in Reswell.
      </Text>

      {data.cash_out_ready ? (
        <>
          <Text style={[styles.section, { color: colors.foreground, fontFamily: fontFamily.headline }]}>Bank</Text>
          {data.banks.map((bank) => {
            const selected = bank.id === bankId
            return (
              <Pressable
                key={bank.id}
                accessibilityRole="button"
                onPress={() => setBankId(bank.id)}
                style={[styles.bank, { borderColor: selected ? colors.listingHeart : colors.border, backgroundColor: colors.background }]}
              >
                <View style={[styles.bankIcon, { backgroundColor: colors.secondary }]}>
                  <SymbolView name={{ ios: "building.columns", android: "account_balance", web: "account_balance" }} size={18} tintColor={colors.listingHeart} />
                </View>
                <View style={styles.bankCopy}>
                  <Text style={[styles.bankName, { color: colors.foreground, fontFamily: fontFamily.text }]}>{bank.label}</Text>
                  {bank.default ? (
                    <Text style={[styles.bankMeta, { color: colors.muted, fontFamily: fontFamily.text }]}>Default</Text>
                  ) : null}
                </View>
                {selected ? (
                  <SymbolView name={{ ios: "checkmark.circle.fill", android: "check_circle", web: "check_circle" }} size={20} tintColor={colors.listingHeart} />
                ) : null}
              </Pressable>
            )
          })}
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => void openStripe("add")} style={styles.textButton}>
            <Text style={[styles.textButtonLabel, { color: colors.listingHeart, fontFamily: fontFamily.text }]}>
              {busy && waitingOnStripe ? "Opening Stripe…" : "Add a bank"}
            </Text>
          </Pressable>

          <Text style={[styles.section, { color: colors.foreground, fontFamily: fontFamily.headline }]}>Amount</Text>
          <View style={[styles.amountField, { borderColor: colors.border }]}>
            <Text style={[styles.dollar, { color: colors.muted, fontFamily: fontFamily.text }]}>$</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder={data.minimum_usd.toFixed(2)}
              placeholderTextColor={colors.muted}
              style={[styles.amountInput, { color: colors.foreground, fontFamily: fontFamily.text }]}
            />
          </View>

          <Text style={[styles.section, { color: colors.foreground, fontFamily: fontFamily.headline }]}>Arrival</Text>
          <SpeedChoice
            title="Standard"
            detail="1–3 business days · no fee"
            selected={speed === "standard"}
            onPress={() => setSpeed("standard")}
          />
          <SpeedChoice
            title="Instant"
            detail={`About 30 minutes · ${feeLabel} fee`}
            selected={speed === "instant"}
            onPress={() => setSpeed("instant")}
          />
          {speed === "instant" && Number.isFinite(parsed) && parsed > 0 ? (
            <Text style={[styles.lead, { color: colors.muted, fontFamily: fontFamily.text }]}>
              Fee ${instantFee.toFixed(2)}. ${arrives.toFixed(2)} reaches the bank.
            </Text>
          ) : null}

          {error ? <Text style={[styles.error, { color: colors.destructive, fontFamily: fontFamily.text }]}>{error}</Text> : null}

          <Pressable
            accessibilityRole="button"
            disabled={!canSend}
            onPress={() => void transfer()}
            style={[styles.primary, { backgroundColor: canSend ? colors.sellerProfileBannerDefault : "#ECECEF" }]}
          >
            <Text style={[styles.primaryLabel, { color: canSend ? "#FFFFFF" : "#C8C8CC", fontFamily: fontFamily.text }]}>
              {busy ? "Sending…" : "Transfer funds"}
            </Text>
          </Pressable>
        </>
      ) : (
        <View style={[styles.setup, { backgroundColor: colors.secondary }]}>
          <Text style={[styles.section, { color: colors.foreground, fontFamily: fontFamily.headline }]}>{data.payout_label}</Text>
          <Text style={[styles.lead, { color: colors.muted, fontFamily: fontFamily.text }]}>{data.payout_detail}</Text>
          {error ? <Text style={[styles.error, { color: colors.destructive, fontFamily: fontFamily.text }]}>{error}</Text> : null}
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void openStripe("connect")}
            style={[styles.primary, { backgroundColor: colors.sellerProfileBannerDefault }]}
          >
            <Text style={[styles.primaryLabel, { color: "#FFFFFF", fontFamily: fontFamily.text }]}>
              {busy ? "Opening Stripe…" : "Connect bank"}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  )
}

function SpeedChoice({
  title,
  detail,
  selected,
  onPress,
}: {
  title: string
  detail: string
  selected: boolean
  onPress: () => void
}) {
  const colors = useReswellColors()
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.speed, { borderColor: selected ? colors.listingHeart : colors.border }]}
    >
      <View style={styles.bankCopy}>
        <Text style={[styles.bankName, { color: colors.foreground, fontFamily: fontFamily.text }]}>{title}</Text>
        <Text style={[styles.bankMeta, { color: colors.muted, fontFamily: fontFamily.text }]}>{detail}</Text>
      </View>
      <View style={[styles.radio, { borderColor: selected ? colors.listingHeart : colors.border, backgroundColor: selected ? colors.listingHeart : "transparent" }]} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, gap: 10 },
  eyebrow: { fontSize: 12, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase" },
  title: { fontSize: 28, fontWeight: "700", letterSpacing: -0.4 },
  amount: { fontSize: 40, fontWeight: "700", letterSpacing: -1 },
  lead: { fontSize: 15, lineHeight: 21 },
  section: { fontSize: 18, fontWeight: "700", marginTop: 8 },
  bank: {
    minHeight: 64,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  bankIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  bankCopy: { flex: 1, gap: 2 },
  bankName: { fontSize: 16, fontWeight: "600" },
  bankMeta: { fontSize: 13 },
  textButton: { alignSelf: "flex-start", paddingVertical: 4 },
  textButtonLabel: { fontSize: 15, fontWeight: "700" },
  amountField: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dollar: { fontSize: 18, fontWeight: "600" },
  amountInput: { flex: 1, fontSize: 18, paddingVertical: 12 },
  speed: {
    minHeight: 64,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5 },
  primary: { minHeight: 50, borderRadius: 25, alignItems: "center", justifyContent: "center", marginTop: 8 },
  primaryLabel: { fontSize: 17, fontWeight: "700" },
  setup: { borderRadius: 16, padding: 16, gap: 8, marginTop: 8 },
  successMark: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", marginTop: 24 },
  error: { fontSize: 14, lineHeight: 20 },
})
