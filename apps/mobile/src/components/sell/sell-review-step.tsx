import { Image } from "expo-image"
import { StyleSheet, Text, View } from "react-native"
import { boardSpecReviewLines, formatSellPrice, sellConditionLabel, sellFulfillmentSummary, type SellDraft } from "@/lib/sell-flow"
import type { MobileSellBoardSpecs, MobileSellTaxonomy } from "@reswell/api-contract"
import { fontFamily, useReswellColors } from "@/theme"

export function SellReviewStep({
  draft,
  taxonomy,
  boardSpecs,
  signedIn,
}: {
  draft: SellDraft
  taxonomy: MobileSellTaxonomy | null
  boardSpecs: MobileSellBoardSpecs | null
  signedIn: boolean
}) {
  const colors = useReswellColors()
  const category = taxonomy?.categories.find((item) => item.slug === draft.category) ?? null
  const subcategory = category?.subcategories.find((item) => item.slug === draft.subcategory) ?? null
  const fulfillment = sellFulfillmentSummary(draft, category?.fulfillment)
  const specLines = boardSpecReviewLines(draft, boardSpecs)

  return (
    <View style={styles.stack}>
      <View style={styles.photos}>
        {draft.photos.map((photo) => (
          <Image key={photo.id} source={{ uri: photo.uri }} style={[styles.photo, { backgroundColor: colors.image }]} contentFit="cover" />
        ))}
      </View>
      <ReviewLine label="Title" value={draft.title.trim()} />
      <ReviewLine label="Brand" value={draft.brand.trim()} />
      <ReviewLine label="Model" value={draft.model.trim()} />
      <ReviewLine label="Category" value={category?.label ?? draft.category} />
      {subcategory && category?.subcategory_label ? (
        <ReviewLine label={category.subcategory_label} value={subcategory.label} />
      ) : null}
      {specLines.map((line) => (
        <ReviewLine key={line.label} label={line.label} value={line.value} />
      ))}
      <ReviewLine label="Condition" value={sellConditionLabel(draft.condition)} />
      <ReviewLine label="Description" value={draft.description.trim()} />
      <ReviewLine label="Price" value={formatSellPrice(draft.price)} />
      <ReviewLine label="Location" value={draft.locationLabel.trim() || `${draft.city.trim()}, ${draft.state.trim()}`} />
      <ReviewLine label="Fulfillment" value={fulfillment} />
      <Text style={[styles.note, { color: colors.muted, fontFamily: fontFamily.text }]}>
        {signedIn
          ? "Publishing from the app isn’t connected yet. This draft stays on this screen."
          : "Sign in to publish. This draft stays on this screen until then."}
      </Text>
    </View>
  )
}

function ReviewLine({ label, value }: { label: string; value: string }) {
  const colors = useReswellColors()
  return (
    <View style={[styles.line, { borderBottomColor: colors.border }]}>
      <Text style={[styles.label, { color: colors.muted, fontFamily: fontFamily.text }]}>{label}</Text>
      <Text style={[styles.value, { color: colors.foreground, fontFamily: fontFamily.text }]}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  stack: { gap: 4 },
  photos: { flexDirection: "row", gap: 8, marginBottom: 12 },
  photo: { width: 72, height: 72, borderRadius: 8 },
  line: { gap: 2, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  label: { fontSize: 13, fontWeight: "600" },
  value: { fontSize: 16 },
  note: { fontSize: 15, paddingTop: 12 },
})
