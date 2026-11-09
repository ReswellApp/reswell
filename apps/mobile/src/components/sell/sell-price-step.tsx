import { StyleSheet, Text, View } from "react-native"
import { SellField } from "@/components/sell/sell-field"
import { priceUsd, sanitizePriceInput, type SellDraft } from "@/lib/sell-flow"
import { fontFamily, useReswellColors } from "@/theme"

export function SellPriceStep({
  draft,
  onChange,
}: {
  draft: SellDraft
  onChange: (patch: Partial<SellDraft>) => void
}) {
  const colors = useReswellColors()
  const price = priceUsd(draft.price)
  const invalid = draft.price.length > 0 && (price < 0.01 || price > 999_999.99)

  return (
    <View style={styles.stack}>
      <SellField
        label="Price"
        value={draft.price}
        onChangeText={(value) => onChange({ price: sanitizePriceInput(value) })}
        placeholder="0.00"
        keyboardType="decimal-pad"
        autoCapitalize="none"
      />
      {invalid ? (
        <Text style={[styles.error, { color: colors.destructive, fontFamily: fontFamily.text }]}>
          Enter a price between $0.01 and $999,999.99.
        </Text>
      ) : (
        <Text style={[styles.hint, { color: colors.muted, fontFamily: fontFamily.text }]}>
          Buyers see this price. Fees are calculated when you publish.
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  stack: { gap: 8 },
  hint: { fontSize: 15 },
  error: { fontSize: 15 },
})
