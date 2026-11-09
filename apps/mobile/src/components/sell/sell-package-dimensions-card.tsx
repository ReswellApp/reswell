import { useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import { SellField } from "@/components/sell/sell-field"
import { FedExCarrierMark, UpsCarrierMark, UspsCarrierMark } from "@/components/sell/sell-carrier-marks"
import { SellMeasurementTipsModal } from "@/components/sell/sell-measurement-tips-modal"
import type { SellDraft } from "@/lib/sell-flow"
import { SURFBOARDS_CATEGORY_SLUG } from "@/lib/sell-flow"
import { fontFamily, useReswellColors } from "@/theme"

export function SellPackageDimensionsCard({
  draft,
  onChange,
}: {
  draft: SellDraft
  onChange: (patch: Partial<SellDraft>) => void
}) {
  const colors = useReswellColors()
  const [tipsOpen, setTipsOpen] = useState(false)
  const surfboard = draft.category === SURFBOARDS_CATEGORY_SLUG

  return (
    <View style={[styles.card, { borderColor: colors.foreground, backgroundColor: colors.background }]}>
      <Text style={[styles.heading, { color: colors.foreground, fontFamily: fontFamily.text }]}>
        Package size and weight
        <Text style={{ color: colors.destructive }}> *</Text>
      </Text>
      <Text style={[styles.intro, { color: colors.muted, fontFamily: fontFamily.text }]}>
        Round your weight and measurements up to the nearest ounce and inch to avoid additional charges from the
        carrier.{" "}
        <Text
          onPress={() => setTipsOpen(true)}
          style={[styles.link, { color: colors.foreground, fontFamily: fontFamily.text }]}
        >
          Measurement tips
        </Text>
      </Text>

      <View style={[styles.carrierBox, { backgroundColor: colors.image, borderColor: colors.border }]}>
        <View style={styles.carrierMarks}>
          <FedExCarrierMark />
          <UpsCarrierMark />
          <UspsCarrierMark />
        </View>
        <Text style={[styles.carrierTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>
          The buyer will pay for your discounted shipping label.
        </Text>
        <Text style={[styles.carrierDetail, { color: colors.muted, fontFamily: fontFamily.text }]}>
          {surfboard
            ? "You'll ship with FedEx or UPS using the box size you enter."
            : "You'll ship with FedEx, UPS, or USPS, depending on your buyer's location and your package."}
        </Text>
      </View>

      <View style={styles.row}>
        <View style={styles.cell}>
          <SellField
            label="Length"
            required
            value={draft.packageLength}
            onChangeText={(packageLength) => onChange({ packageLength })}
            placeholder="0"
            keyboardType="decimal-pad"
            autoCapitalize="none"
            suffix="in"
          />
        </View>
        <View style={styles.cell}>
          <SellField
            label="Width"
            required
            value={draft.packageWidth}
            onChangeText={(packageWidth) => onChange({ packageWidth })}
            placeholder="0"
            keyboardType="decimal-pad"
            autoCapitalize="none"
            suffix="in"
          />
        </View>
        <View style={styles.cell}>
          <SellField
            label="Height"
            required
            value={draft.packageHeight}
            onChangeText={(packageHeight) => onChange({ packageHeight })}
            placeholder="0"
            keyboardType="decimal-pad"
            autoCapitalize="none"
            suffix="in"
          />
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.cell}>
          <SellField
            label="Weight (lb)"
            required
            value={draft.packageWeightLb}
            onChangeText={(packageWeightLb) => onChange({ packageWeightLb })}
            placeholder="0"
            keyboardType="decimal-pad"
            autoCapitalize="none"
            suffix="lb"
          />
        </View>
        <View style={styles.cell}>
          <SellField
            label="Weight (oz)"
            required
            value={draft.packageWeightOz}
            onChangeText={(packageWeightOz) => onChange({ packageWeightOz })}
            placeholder="0"
            keyboardType="decimal-pad"
            autoCapitalize="none"
            suffix="oz"
          />
        </View>
      </View>

      <SellMeasurementTipsModal visible={tipsOpen} onClose={() => setTipsOpen(false)} />
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 12 },
  heading: { fontSize: 16, fontWeight: "700" },
  intro: { fontSize: 14, lineHeight: 20 },
  link: { fontWeight: "600", textDecorationLine: "underline" },
  carrierBox: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 12, gap: 8 },
  carrierMarks: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  carrierTitle: { fontSize: 15, fontWeight: "700", lineHeight: 21 },
  carrierDetail: { fontSize: 14, lineHeight: 20 },
  row: { flexDirection: "row", gap: 8 },
  cell: { flex: 1, minWidth: 0 },
})
