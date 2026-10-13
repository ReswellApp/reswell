import { SymbolView } from "expo-symbols"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { SellField } from "@/components/sell/sell-field"
import { SELL_CONDITIONS, type SellDraft } from "@/lib/sell-flow"
import { fontFamily, useReswellColors } from "@/theme"

export function SellDetailsStep({
  draft,
  onChange,
}: {
  draft: SellDraft
  onChange: (patch: Partial<SellDraft>) => void
}) {
  const colors = useReswellColors()

  return (
    <View style={styles.stack}>
      <SellField
        label="Description"
        value={draft.description}
        onChangeText={(description) => onChange({ description })}
        placeholder="Condition notes, dimensions, what's included"
        multiline
      />
      <View style={styles.conditions}>
        <Text style={[styles.label, { color: colors.muted, fontFamily: fontFamily.text }]}>Condition</Text>
        {SELL_CONDITIONS.map((option) => {
          const selected = draft.condition === option.value
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange({ condition: option.value })}
              style={[styles.row, { borderBottomColor: colors.border }]}
            >
              <Text style={[styles.rowLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                {option.label}
              </Text>
              {selected ? (
                <SymbolView
                  name={{ ios: "checkmark", android: "check", web: "check" }}
                  size={18}
                  tintColor={colors.foreground}
                  weight="semibold"
                />
              ) : null}
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  stack: { gap: 20 },
  conditions: { gap: 0 },
  label: { fontSize: 13, fontWeight: "600", marginBottom: 4 },
  row: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: { fontSize: 16 },
})
