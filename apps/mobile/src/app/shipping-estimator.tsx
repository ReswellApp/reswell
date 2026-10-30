import { Stack } from "expo-router"
import { useEffect, useState } from "react"
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import type { MobileShippingEstimate, MobileShippingEstimator } from "@reswell/api-contract"
import { SCREEN_GUTTER, ScreenScroll, ScreenShell } from "@/components/screen-shell"
import { estimateShipping, fetchShippingEstimator } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useAuthGate } from "@/lib/auth-gate"
import { fontFamily, useReswellColors } from "@/theme"

function digits(value: string, max: number): string {
  return value.replace(/\D/g, "").slice(0, max)
}

function decimal(value: string): string {
  const cleaned = value.replace(/[^\d.]/g, "")
  const [whole, ...rest] = cleaned.split(".")
  if (rest.length === 0) return whole ?? ""
  return `${whole ?? ""}.${rest.join("").slice(0, 2)}`
}

function toNumber(value: string): number {
  return Number(value)
}

export default function ShippingEstimatorScreen() {
  const colors = useReswellColors()
  const { session } = useAuth()
  const { requestAuth } = useAuthGate()
  const [page, setPage] = useState<MobileShippingEstimator | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [originZip, setOriginZip] = useState("")
  const [destinationZip, setDestinationZip] = useState("")
  const [weightLb, setWeightLb] = useState("")
  const [lengthIn, setLengthIn] = useState("")
  const [widthIn, setWidthIn] = useState("")
  const [heightIn, setHeightIn] = useState("")
  const [quote, setQuote] = useState<MobileShippingEstimate | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchShippingEstimator()
      .then((next) => {
        if (!cancelled) setPage(next)
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load the estimator")
      })
    return () => {
      cancelled = true
    }
  }, [])

  function applyPreset(id: string) {
    const preset = page?.presets.find((item) => item.id === id)
    if (!preset) return
    setWeightLb(String(preset.weight_lb))
    setLengthIn(String(preset.length_in))
    setWidthIn(String(preset.width_in))
    setHeightIn(String(preset.height_in))
    setQuote(null)
    setFormError(null)
  }

  function submit() {
    requestAuth((token) => {
      const body = {
        origin_zip: originZip,
        destination_zip: destinationZip,
        weight_lb: toNumber(weightLb),
        length_in: toNumber(lengthIn),
        width_in: toNumber(widthIn),
        height_in: toNumber(heightIn),
      }
      setBusy(true)
      setFormError(null)
      setQuote(null)
      estimateShipping(token, body)
        .then((next) => setQuote(next))
        .catch((cause: unknown) => {
          setFormError(cause instanceof Error ? cause.message : "Unable to get rates")
        })
        .finally(() => setBusy(false))
    })
  }

  return (
    <ScreenShell style={{ backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: "Shipping estimator" }} />
      {!page && !error ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.foreground} />
        </View>
      ) : null}
      {error && !page ? (
        <View style={styles.center}>
          <Text style={[styles.body, { color: colors.muted, fontFamily: fontFamily.text }]}>{error}</Text>
        </View>
      ) : null}
      {page ? (
        <ScreenScroll contentContainerStyle={styles.page}>
          <Text style={[styles.title, { color: colors.foreground, fontFamily: fontFamily.headline }]}>{page.title}</Text>
          <Text style={[styles.body, { color: colors.muted, fontFamily: fontFamily.text }]}>{page.description}</Text>

          <View style={styles.presetRow}>
            {page.presets.map((preset) => (
              <Pressable
                key={preset.id}
                onPress={() => applyPreset(preset.id)}
                style={[styles.preset, { backgroundColor: colors.secondary }]}
              >
                <Text style={[styles.presetTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                  {preset.title}
                </Text>
                <Text style={[styles.presetSummary, { color: colors.muted, fontFamily: fontFamily.text }]}>
                  {preset.summary}
                </Text>
              </Pressable>
            ))}
          </View>

          <Field label="Ship from ZIP" value={originZip} onChange={(value) => setOriginZip(digits(value, 5))} keyboard="number-pad" />
          <Field
            label="Ship to ZIP"
            value={destinationZip}
            onChange={(value) => setDestinationZip(digits(value, 5))}
            keyboard="number-pad"
          />
          <Field label="Packed weight (lb)" value={weightLb} onChange={(value) => setWeightLb(decimal(value))} keyboard="decimal-pad" />
          <View style={styles.dims}>
            <Field label="L (in)" value={lengthIn} onChange={(value) => setLengthIn(decimal(value))} keyboard="decimal-pad" compact />
            <Field label="W (in)" value={widthIn} onChange={(value) => setWidthIn(decimal(value))} keyboard="decimal-pad" compact />
            <Field label="H (in)" value={heightIn} onChange={(value) => setHeightIn(decimal(value))} keyboard="decimal-pad" compact />
          </View>

          {formError ? (
            <Text style={[styles.body, { color: colors.destructive, fontFamily: fontFamily.text }]}>{formError}</Text>
          ) : null}

          <Pressable
            onPress={submit}
            disabled={busy}
            style={[styles.cta, { backgroundColor: colors.sold, opacity: busy ? 0.7 : 1 }]}
          >
            {busy ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={[styles.ctaLabel, { color: colors.primaryForeground, fontFamily: fontFamily.headline }]}>
                {session?.access_token ? "Get rates" : "Sign in to get rates"}
              </Text>
            )}
          </Pressable>

          {quote ? (
            <View style={styles.rates}>
              <Text style={[styles.route, { color: colors.muted, fontFamily: fontFamily.text }]}>{quote.route_label}</Text>
              {quote.rates.length === 0 ? (
                <Text style={[styles.body, { color: colors.muted, fontFamily: fontFamily.text }]}>
                  No rates returned — try different dimensions.
                </Text>
              ) : (
                quote.rates.map((rate, index) => (
                  <View key={`${rate.carrier_name}-${rate.service_name}-${index}`} style={[styles.rate, { backgroundColor: colors.secondary }]}>
                    <View style={styles.rateCopy}>
                      <Text style={[styles.rateTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                        {rate.carrier_name}
                      </Text>
                      <Text style={[styles.body, { color: colors.muted, fontFamily: fontFamily.text }]}>
                        {rate.service_name}
                        {rate.delivery_days != null ? ` · ${rate.delivery_days} day${rate.delivery_days === 1 ? "" : "s"}` : ""}
                      </Text>
                    </View>
                    <Text style={[styles.ratePrice, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
                      {rate.total_label}
                    </Text>
                  </View>
                ))
              )}
            </View>
          ) : null}
        </ScreenScroll>
      ) : null}
    </ScreenShell>
  )
}

function Field({
  label,
  value,
  onChange,
  keyboard,
  compact,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  keyboard: "number-pad" | "decimal-pad"
  compact?: boolean
}) {
  const colors = useReswellColors()
  return (
    <View style={[styles.field, compact ? styles.compactField : null]}>
      <Text style={[styles.fieldLabel, { color: colors.muted, fontFamily: fontFamily.text }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={keyboard}
        accessibilityLabel={label}
        style={[
          styles.input,
          { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.secondary },
        ]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  page: { paddingHorizontal: SCREEN_GUTTER, paddingTop: 8, paddingBottom: 32, gap: 14 },
  title: { fontSize: 26, fontWeight: "700" },
  body: { fontSize: 15, lineHeight: 22 },
  presetRow: { gap: 8 },
  preset: { borderRadius: 14, padding: 12, gap: 4 },
  presetTitle: { fontSize: 15, fontWeight: "700" },
  presetSummary: { fontSize: 13 },
  dims: { flexDirection: "row", gap: 10 },
  field: { gap: 6 },
  compactField: { flex: 1 },
  fieldLabel: { fontSize: 12, fontWeight: "700" },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, minHeight: 44, paddingHorizontal: 12, fontSize: 16 },
  cta: { borderRadius: 999, minHeight: 48, alignItems: "center", justifyContent: "center" },
  ctaLabel: { fontSize: 16, fontWeight: "700" },
  rates: { gap: 10, marginTop: 8 },
  route: { fontSize: 13, lineHeight: 18 },
  rate: { borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  rateCopy: { flex: 1, gap: 2 },
  rateTitle: { fontSize: 16, fontWeight: "700" },
  ratePrice: { fontSize: 16, fontWeight: "700" },
})
