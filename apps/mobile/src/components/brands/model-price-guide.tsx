import { StyleSheet, Text, View } from "react-native"
import type { MobileModelPage } from "@reswell/api-contract"
import { fontFamily, useReswellColors } from "@/theme"

export function ModelPriceGuide({ page }: { page: MobileModelPage }) {
  const colors = useReswellColors()
  const guide = page.price_guide
  if (!guide) return null
  const bands = guide.bands.filter((band) => band.comps > 0)

  return (
    <View style={[styles.card, { backgroundColor: colors.secondary }]}>
      <Text style={[styles.kicker, { color: colors.muted, fontFamily: fontFamily.text }]}>What it sells for</Text>
      <View style={styles.stats}>
        <Stat label="Sold median" value={guide.sold_median_label} />
        <Stat label="Asking" value={guide.asking_median_label} />
        <Stat label="Sold" value={String(guide.sold_count)} />
      </View>
      {bands.length > 0 ? (
        <View style={[styles.bands, { borderTopColor: colors.border }]}>
          {bands.map((band) => (
            <View key={band.condition_label} style={styles.band}>
              <Text style={[styles.bandLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                {band.condition_label}
              </Text>
              <Text style={[styles.bandValue, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
                {band.typical_label}
              </Text>
              <Text style={[styles.bandComps, { color: colors.muted, fontFamily: fontFamily.text }]}>
                {band.comps} {band.comps === 1 ? "comp" : "comps"}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      <Text style={[styles.confidence, { color: colors.muted, fontFamily: fontFamily.text }]}>
        {guide.confidence_label}
      </Text>
    </View>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  const colors = useReswellColors()
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: colors.foreground, fontFamily: fontFamily.headline }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.muted, fontFamily: fontFamily.text }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderCurve: "continuous", padding: 16, gap: 8 },
  kicker: { fontSize: 12, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase" },
  stats: { flexDirection: "row", gap: 8 },
  stat: { flex: 1, gap: 2 },
  statValue: { fontSize: 15, fontWeight: "700", fontVariant: ["tabular-nums"] },
  statLabel: { fontSize: 11, fontWeight: "600" },
  bands: { marginTop: 6, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, gap: 8 },
  band: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  bandLabel: { flex: 1, fontSize: 14, fontWeight: "600" },
  bandValue: { fontSize: 14, fontWeight: "700", fontVariant: ["tabular-nums"] },
  bandComps: { fontSize: 12, fontWeight: "600", width: 64, textAlign: "right" },
  confidence: { fontSize: 12, marginTop: 2 },
})
