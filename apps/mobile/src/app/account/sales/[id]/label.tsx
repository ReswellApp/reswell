import { Image } from "expo-image"
import { useLocalSearchParams } from "expo-router"
import { SymbolView } from "expo-symbols"
import { useState, type ComponentProps } from "react"
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { AccountState } from "@/components/account-state"
import { saleLabelImageUrl } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { printSaleLabel, shareSaleLabel } from "@/lib/sale-label"
import { fontFamily, useReswellColors } from "@/theme"

export default function SaleLabelScreen() {
  const colors = useReswellColors()
  const insets = useSafeAreaInsets()
  const { session } = useAuth()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [busy, setBusy] = useState<"share" | "print" | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const token = session?.access_token ?? null
  const uri = id ? `${saleLabelImageUrl(id)}?r=${attempt}` : null
  const canAct = Boolean(id && token && !busy)

  const run = (kind: "share" | "print") => {
    if (!id || !token || busy) return
    setBusy(kind)
    setActionError(null)
    const task = kind === "share" ? shareSaleLabel(token, id) : printSaleLabel(token, id)
    void task
      .catch((cause: unknown) => {
        setActionError(cause instanceof Error ? cause.message : "Unable to open the shipping label")
      })
      .finally(() => setBusy(null))
  }

  return (
    <AccountState
      title="Shipping label"
      loading={!uri || !token}
      error={token ? null : "Sign in required"}
      onRetry={() => setAttempt((current) => current + 1)}
      empty="No shipping label for this order."
      isEmpty={!uri}
      searchHeader={false}
      edgeToEdgeBottom
    >
      {uri && token ? (
        <View style={styles.page}>
          {failed ? (
            <View style={styles.center}>
              <Text style={[styles.message, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                Unable to display this shipping label.
              </Text>
              <Pressable
                onPress={() => {
                  setFailed(false)
                  setAttempt((current) => current + 1)
                }}
              >
                <Text style={[styles.retry, { color: colors.foreground, fontFamily: fontFamily.text }]}>Try again</Text>
              </Pressable>
            </View>
          ) : (
            <Image
              source={{ uri, headers: { Authorization: `Bearer ${token}` } }}
              style={[styles.image, { backgroundColor: colors.background }]}
              contentFit="contain"
              accessibilityLabel="Shipping label"
              onError={() => setFailed(true)}
            />
          )}
          <View
            style={[
              styles.footer,
              { borderTopColor: colors.border, backgroundColor: colors.background, paddingBottom: Math.max(insets.bottom, 12) },
            ]}
          >
            {actionError ? (
              <Text style={[styles.notice, { color: colors.destructive, fontFamily: fontFamily.text }]}>{actionError}</Text>
            ) : null}
            <View style={styles.row}>
              <LabelAction
                kind="share"
                label="Share"
                busy={busy}
                disabled={!canAct}
                symbol={{ ios: "square.and.arrow.up", android: "share", web: "share" }}
                onPress={() => run("share")}
                outlined
              />
              <LabelAction
                kind="print"
                label="Print"
                busy={busy}
                disabled={!canAct}
                symbol={{ ios: "printer", android: "print", web: "print" }}
                onPress={() => run("print")}
              />
            </View>
          </View>
        </View>
      ) : null}
    </AccountState>
  )
}

function LabelAction({
  kind,
  label,
  busy,
  disabled,
  symbol,
  onPress,
  outlined = false,
}: {
  kind: "share" | "print"
  label: string
  busy: "share" | "print" | null
  disabled: boolean
  symbol: ComponentProps<typeof SymbolView>["name"]
  onPress: () => void
  outlined?: boolean
}) {
  const colors = useReswellColors()
  const pending = busy === kind
  const ink = outlined ? colors.foreground : colors.primaryForeground
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.button,
        outlined
          ? { borderColor: colors.border, backgroundColor: colors.background, borderWidth: 1 }
          : { backgroundColor: colors.foreground },
        { opacity: disabled ? 0.55 : 1 },
      ]}
    >
      {pending ? (
        <ActivityIndicator color={ink} />
      ) : (
        <SymbolView name={symbol} size={18} tintColor={ink} />
      )}
      <Text style={[styles.buttonLabel, { color: ink, fontFamily: fontFamily.text }]}>
        {pending ? (kind === "share" ? "Sharing…" : "Printing…") : label}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  image: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  message: { fontSize: 16, textAlign: "center" },
  retry: { fontSize: 16, fontWeight: "600" },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  button: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  buttonLabel: { fontSize: 16, fontWeight: "700" },
  notice: { fontSize: 14 },
})
