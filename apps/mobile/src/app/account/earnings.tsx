import { useCallback, useEffect, useState } from "react"
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import type { MobileEarnings } from "@reswell/api-contract"
import { DashboardPageGate } from "@/components/dashboard-page-gate"
import { cashOutEarnings, fetchEarnings, startPayoutOnboarding } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useAccountResource } from "@/lib/use-account-resource"
import { fontFamily, useReswellColors } from "@/theme"

export default function AccountEarningsScreen() {
  const colors = useReswellColors()
  const load = useCallback((accessToken: string) => fetchEarnings(accessToken), [])
  const earnings = useAccountResource(load)

  return (
    <DashboardPageGate id="earnings" title="Earnings">
      {() => (
        <ScrollView contentContainerStyle={styles.page}>
          {earnings.loading && !earnings.data ? (
            <Text style={[styles.loading, { color: colors.muted, fontFamily: fontFamily.text }]}>Loading earnings…</Text>
          ) : earnings.error && !earnings.data ? (
            <Text style={[styles.loading, { color: colors.foreground, fontFamily: fontFamily.text }]}>{earnings.error}</Text>
          ) : earnings.data ? (
            <EarningsBody data={earnings.data} onReload={earnings.reload} />
          ) : null}
        </ScrollView>
      )}
    </DashboardPageGate>
  )
}

function EarningsBody({ data, onReload }: { data: MobileEarnings; onReload: () => void }) {
  const colors = useReswellColors()
  return (
    <View style={styles.body}>
      <View style={[styles.hero, { backgroundColor: colors.foreground }]}>
        <Text style={[styles.heroLabel, { color: colors.background, fontFamily: fontFamily.text }]}>Available</Text>
        <Text style={[styles.heroAmount, { color: colors.background, fontFamily: fontFamily.headline }]}>{data.available_label}</Text>
        <Text style={[styles.heroNote, { color: colors.background, fontFamily: fontFamily.text }]}>
          {data.ready_label} ready to cash out · {data.pending_label} pending
        </Text>
      </View>

      <View style={styles.stats}>
        <Stat label="Last 30 days" value={data.earned_last_30d_label} />
        <Stat label="Paid out" value={data.cashed_out_label} />
      </View>

      <CashOut data={data} onReload={onReload} />

      <Text style={[styles.section, { color: colors.foreground, fontFamily: fontFamily.headline }]}>Activity</Text>
      {data.activity.length === 0 ? (
        <Text style={[styles.detail, { color: colors.muted, fontFamily: fontFamily.text }]}>No earnings activity yet.</Text>
      ) : (
        data.activity.map((item) => (
          <View key={item.id} style={[styles.row, { borderBottomColor: colors.border }]}>
            <View style={styles.rowCopy}>
              <Text style={[styles.rowTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>{item.title}</Text>
              <Text style={[styles.detail, { color: colors.muted, fontFamily: fontFamily.text }]}>
                {item.status_label} · {activityDate(item.created_at)}
              </Text>
            </View>
            <Text style={[styles.rowAmount, { color: colors.foreground, fontFamily: fontFamily.text }]}>{item.amount_label}</Text>
          </View>
        ))
      )}
    </View>
  )
}

function CashOut({ data, onReload }: { data: MobileEarnings; onReload: () => void }) {
  const colors = useReswellColors()
  const { session } = useAuth()
  const [amount, setAmount] = useState(data.ready_usd >= data.minimum_usd ? data.ready_usd.toFixed(2) : "")
  const [speed, setSpeed] = useState<"standard" | "instant">("standard")
  const [bankId, setBankId] = useState(data.banks.find((bank) => bank.default)?.id ?? data.banks[0]?.id ?? "")
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    setAmount(data.ready_usd >= data.minimum_usd ? data.ready_usd.toFixed(2) : "")
    setBankId(data.banks.find((bank) => bank.default)?.id ?? data.banks[0]?.id ?? "")
  }, [data.ready_usd, data.minimum_usd, data.banks])
  const parsed = Number(amount)
  const instantFee = speed === "instant" && Number.isFinite(parsed) ? Math.round(parsed * data.instant_fee_rate * 100) / 100 : 0

  async function run(action: () => Promise<void>) {
    const token = session?.access_token
    if (!token || busy) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await action()
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Payout failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={[styles.payout, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <Text style={[styles.section, { color: colors.foreground, fontFamily: fontFamily.headline }]}>{data.payout_label}</Text>
      <Text style={[styles.detail, { color: colors.muted, fontFamily: fontFamily.text }]}>{data.payout_detail}</Text>
      {data.cash_out_ready ? (
        <>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder={data.minimum_usd.toFixed(2)}
            placeholderTextColor={colors.muted}
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, fontFamily: fontFamily.text }]}
          />
          <View style={styles.speeds}>
            <Speed label="Standard" active={speed === "standard"} onPress={() => setSpeed("standard")} />
            <Speed label="Instant · 1.5%" active={speed === "instant"} onPress={() => setSpeed("instant")} />
          </View>
          {data.banks.length > 1 ? (
            <View style={styles.speeds}>
              {data.banks.map((bank) => (
                <Speed key={bank.id} label={bank.label} active={bankId === bank.id} onPress={() => setBankId(bank.id)} />
              ))}
            </View>
          ) : null}
          {speed === "instant" && Number.isFinite(parsed) ? (
            <Text style={[styles.detail, { color: colors.muted, fontFamily: fontFamily.text }]}>
              Instant fee ${instantFee.toFixed(2)}. ${Math.max(0, parsed - instantFee).toFixed(2)} reaches the bank.
            </Text>
          ) : null}
          <Pressable
            disabled={busy}
            onPress={() =>
              void run(async () => {
                const token = session?.access_token
                if (!token) return
                if (!Number.isFinite(parsed) || parsed < data.minimum_usd) {
                  throw new Error(`Enter at least $${data.minimum_usd.toFixed(2)}`)
                }
                if (parsed > data.ready_usd + 0.001) throw new Error("That is more than the ready balance.")
                const result = await cashOutEarnings(token, {
                  amount: parsed,
                  speed,
                  externalAccountId: bankId.startsWith("ba_") ? bankId : undefined,
                })
                setNotice(result.message || `Sent ${result.amount_label}`)
                onReload()
              })
            }
            style={[styles.button, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.buttonLabel, { color: colors.primaryForeground, fontFamily: fontFamily.text }]}>
              {busy ? "Sending…" : "Cash out"}
            </Text>
          </Pressable>
        </>
      ) : (
        <Pressable
          disabled={busy}
          onPress={() =>
            void run(async () => {
              const token = session?.access_token
              if (!token) return
              const link = await startPayoutOnboarding(token)
              await Linking.openURL(link.url)
            })
          }
          style={[styles.button, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.buttonLabel, { color: colors.primaryForeground, fontFamily: fontFamily.text }]}>
            {busy ? "Opening Stripe…" : "Set up bank with Stripe"}
          </Text>
        </Pressable>
      )}
      {notice ? <Text style={[styles.detail, { color: colors.foreground, fontFamily: fontFamily.text }]}>{notice}</Text> : null}
      {error ? <Text style={[styles.detail, { color: colors.destructive, fontFamily: fontFamily.text }]}>{error}</Text> : null}
    </View>
  )
}

function Speed({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const colors = useReswellColors()
  return (
    <Pressable onPress={onPress} style={[styles.speed, { borderColor: colors.border, backgroundColor: active ? colors.foreground : colors.background }]}>
      <Text style={[styles.speedLabel, { color: active ? colors.background : colors.foreground, fontFamily: fontFamily.text }]}>{label}</Text>
    </Pressable>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  const colors = useReswellColors()
  return (
    <View style={[styles.stat, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <Text style={[styles.statLabel, { color: colors.muted, fontFamily: fontFamily.text }]}>{label}</Text>
      <Text style={[styles.statValue, { color: colors.foreground, fontFamily: fontFamily.headline }]}>{value}</Text>
    </View>
  )
}

function activityDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

const styles = StyleSheet.create({
  page: { padding: 16, paddingBottom: 40 },
  loading: { fontSize: 15, paddingVertical: 12 },
  body: { gap: 16 },
  hero: { borderRadius: 20, padding: 20, gap: 8 },
  heroLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 1.4, textTransform: "uppercase", opacity: 0.7 },
  heroAmount: { fontSize: 40, fontWeight: "700", letterSpacing: -1 },
  heroNote: { fontSize: 14, opacity: 0.75 },
  stats: { flexDirection: "row", gap: 12 },
  stat: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 14, gap: 6 },
  statLabel: { fontSize: 12, fontWeight: "600", letterSpacing: 0.6, textTransform: "uppercase" },
  statValue: { fontSize: 20, fontWeight: "700" },
  payout: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 16, gap: 10 },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 18 },
  speeds: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  speed: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  speedLabel: { fontSize: 13, fontWeight: "600" },
  button: { borderRadius: 14, minHeight: 48, alignItems: "center", justifyContent: "center" },
  buttonLabel: { fontSize: 16, fontWeight: "700" },
  section: { fontSize: 18, fontWeight: "700" },
  detail: { fontSize: 14, lineHeight: 20 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  rowCopy: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: "600" },
  rowAmount: { fontSize: 15, fontWeight: "700" },
})
