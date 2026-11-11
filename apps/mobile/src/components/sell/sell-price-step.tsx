import { StyleSheet, Text, View } from "react-native"
import { SellCollapsibleSection } from "@/components/sell/sell-collapsible-section"
import { SellDateField } from "@/components/sell/sell-date-field"
import { SellField } from "@/components/sell/sell-field"
import {
  formatSellPrice,
  priceUsd,
  sanitizePriceInput,
  sellerPurchasePriceAmount,
  sellerPurchasedOnValue,
  SURFBOARDS_CATEGORY_SLUG,
  type SellDraft,
} from "@/lib/sell-flow"
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
  const showPurchase = draft.category === SURFBOARDS_CATEGORY_SLUG
  const purchaseFilled =
    draft.sellerPurchasePrice.trim().length > 0 ||
    draft.sellerPurchasedFrom.trim().length > 0 ||
    draft.sellerPurchasedOn.trim().length > 0
  const paidAmount = sellerPurchasePriceAmount(draft.sellerPurchasePrice)
  const paidInvalid = draft.sellerPurchasePrice.trim().length > 0 && paidAmount === null
  const dateInvalid =
    draft.sellerPurchasedOn.trim().length >= 10 && sellerPurchasedOnValue(draft.sellerPurchasedOn) === null
  const closedSubtitle =
    paidAmount != null
      ? formatSellPrice(String(paidAmount))
      : "Keep track of what you paid versus what it sells for"

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
        <Text selectable style={[styles.error, { color: colors.destructive, fontFamily: fontFamily.text }]}>
          Enter a price between $0.01 and $999,999.99.
        </Text>
      ) : (
        <Text style={[styles.hint, { color: colors.muted, fontFamily: fontFamily.text }]}>
          Buyers see this price. Fees are calculated when you publish.
        </Text>
      )}
      {showPurchase ? (
        <SellCollapsibleSection
          title="What you paid for the board"
          subtitle={closedSubtitle}
          defaultExpanded={purchaseFilled}
        >
          <Text style={[styles.hint, { color: colors.muted, fontFamily: fontFamily.text }]}>
            Keep track of what you paid for the board versus what it sells for. This info is for your
            benefit only.
          </Text>
          <SellField
            label="What you paid"
            value={draft.sellerPurchasePrice}
            onChangeText={(value) => onChange({ sellerPurchasePrice: sanitizePriceInput(value) })}
            placeholder="0.00"
            keyboardType="decimal-pad"
            autoCapitalize="none"
            autoComplete="off"
          />
          {paidInvalid ? (
            <Text selectable style={[styles.error, { color: colors.destructive, fontFamily: fontFamily.text }]}>
              Enter a valid dollar amount or leave it blank.
            </Text>
          ) : (
            <Text style={[styles.privateHint, { color: colors.muted, fontFamily: fontFamily.text }]}>
              Not shown publicly.
            </Text>
          )}
          <SellField
            label="Bought from"
            value={draft.sellerPurchasedFrom}
            onChangeText={(value) => onChange({ sellerPurchasedFrom: value.slice(0, 200) })}
            placeholder="Shop, seller, marketplace"
            autoCapitalize="words"
            autoComplete="off"
          />
          <SellDateField
            label="Date purchased"
            value={draft.sellerPurchasedOn}
            onChange={(sellerPurchasedOn) => onChange({ sellerPurchasedOn })}
          />
          {dateInvalid ? (
            <Text selectable style={[styles.error, { color: colors.destructive, fontFamily: fontFamily.text }]}>
              Choose a date from the calendar, or leave it blank.
            </Text>
          ) : null}
        </SellCollapsibleSection>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  stack: { gap: 8 },
  hint: { fontSize: 15 },
  privateHint: { fontSize: 13 },
  error: { fontSize: 15 },
})
