import { useCallback, useState } from "react"
import { FlatList, Pressable, StyleSheet, Switch, Text, View } from "react-native"
import type { MobileShipper } from "@reswell/api-contract"
import { AccountState } from "@/components/account-state"
import { actOnShipper, fetchShipper } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useAccountResource } from "@/lib/use-account-resource"
import { fontFamily, useReswellColors } from "@/theme"

export default function AccountShipperScreen() {
  const colors = useReswellColors()
  const { session } = useAuth()
  const load = useCallback((accessToken: string) => fetchShipper(accessToken), [])
  const { data, error, loading, reload } = useAccountResource(load)
  const [actionError, setActionError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function run(body: Parameters<typeof actOnShipper>[1]) {
    const token = session?.access_token
    if (!token || pending) return
    setPending(true)
    setActionError(null)
    actOnShipper(token, body)
      .then(() => reload())
      .catch((cause: unknown) => setActionError(cause instanceof Error ? cause.message : "Unable to update Shipper"))
      .finally(() => setPending(false))
  }

  return (
    <AccountState
      title="Shipper"
      loading={loading && !data}
      error={error}
      onRetry={reload}
      empty="Shipper is not available for this account."
      isEmpty={!data}
    >
      {data ? (
        <FlatList
          data={data.jobs}
          keyExtractor={(item) => item.id}
          refreshing={loading}
          onRefresh={reload}
          ListHeaderComponent={<ShipperHeader data={data} pending={pending} error={actionError} onToggle={(enabled) => run({ action: "schedule", enabled })} />}
          ListEmptyComponent={<Text style={[styles.empty, { color: colors.muted, fontFamily: fontFamily.text }]}>No boards on your runs this week.</Text>}
          renderItem={({ item }) => (
            <View style={[styles.job, { borderColor: colors.border }]}>
              <Text style={[styles.title, { color: colors.foreground, fontFamily: fontFamily.text }]}>{item.listing_title}</Text>
              <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>
                {item.status_label} · {item.sale_label}
              </Text>
              <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>
                {item.pickup_label} → {item.dropoff_label}
              </Text>
              <Text style={[styles.meta, { color: colors.foreground, fontFamily: fontFamily.text }]}>{item.next_handoff}</Text>
              <View style={styles.actions}>
                {item.actions.map((action) => (
                  <Pressable key={action.status} disabled={pending} onPress={() => run({ action: "job", job_id: item.id, status: action.status })}>
                    <Text style={[styles.action, { color: colors.foreground, fontFamily: fontFamily.text }]}>{action.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        />
      ) : null}
    </AccountState>
  )
}

function ShipperHeader({
  data,
  pending,
  error,
  onToggle,
}: {
  data: MobileShipper
  pending: boolean
  error: string | null
  onToggle: (enabled: boolean) => void
}) {
  const colors = useReswellColors()
  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={[styles.week, { color: colors.muted, fontFamily: fontFamily.text }]}>{data.week_label}</Text>
          <Text style={[styles.name, { color: colors.foreground, fontFamily: fontFamily.headline }]}>{data.display_name}</Text>
          <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>
            {data.schedule_enabled ? "On. You can be matched." : "Off. Turn Shipper on when you are driving."}
          </Text>
        </View>
        <Switch
          value={data.schedule_enabled}
          disabled={pending}
          onValueChange={onToggle}
          accessibilityLabel="Turn Shipper on or off"
        />
      </View>
      <Text style={[styles.meta, { color: colors.foreground, fontFamily: fontFamily.text }]}>
        {data.price_label} · {data.job_count} boards · {data.run_count} runs on
      </Text>
      {error ? <Text style={[styles.meta, { color: colors.destructive, fontFamily: fontFamily.text }]}>{error}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  header: { padding: 20, gap: 8 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerCopy: { flex: 1, gap: 4 },
  week: { fontSize: 13, textTransform: "uppercase" },
  name: { fontSize: 24, fontWeight: "700" },
  meta: { fontSize: 15, lineHeight: 21 },
  empty: { textAlign: "center", padding: 24, fontSize: 15 },
  job: { marginHorizontal: 16, marginBottom: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 14, gap: 4 },
  title: { fontSize: 16, fontWeight: "700" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 8 },
  action: { fontSize: 15, fontWeight: "700" },
})
