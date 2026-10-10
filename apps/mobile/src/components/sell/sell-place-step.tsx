import { StyleSheet, Switch, Text, View } from "react-native"
import { SellField } from "@/components/sell/sell-field"
import type { SellDraft } from "@/lib/sell-flow"
import { fontFamily, useReswellColors } from "@/theme"

export function SellPlaceStep({
  draft,
  onChange,
}: {
  draft: SellDraft
  onChange: (patch: Partial<SellDraft>) => void
}) {
  const colors = useReswellColors()
  const needsFulfillment = !draft.localPickup && !draft.shipping

  return (
    <View style={styles.stack}>
      <SellField
        label="City"
        value={draft.city}
        onChangeText={(city) => onChange({ city })}
        placeholder="Santa Cruz"
        autoCapitalize="words"
      />
      <SellField
        label="State"
        value={draft.state}
        onChangeText={(state) => onChange({ state: state.toUpperCase().slice(0, 2) })}
        placeholder="CA"
        autoCapitalize="characters"
      />
      <FulfillmentRow
        label="Local pickup"
        value={draft.localPickup}
        onValueChange={(localPickup) => onChange({ localPickup })}
      />
      <FulfillmentRow
        label="Shipping"
        value={draft.shipping}
        onValueChange={(shipping) => onChange({ shipping })}
      />
      {needsFulfillment ? (
        <Text style={[styles.hint, { color: colors.destructive, fontFamily: fontFamily.text }]}>
          Choose pickup, shipping, or both.
        </Text>
      ) : null}
    </View>
  )
}

function FulfillmentRow({
  label,
  value,
  onValueChange,
}: {
  label: string
  value: boolean
  onValueChange: (value: boolean) => void
}) {
  const colors = useReswellColors()
  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <Text style={[styles.rowLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>{label}</Text>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: "#34C759" }}
        thumbColor="#FFFFFF"
        ios_backgroundColor={colors.border}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  stack: { gap: 16 },
  row: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: { fontSize: 16 },
  hint: { fontSize: 15 },
})
