import { Image } from "expo-image"
import { StyleSheet, Text, View } from "react-native"
import { formatSellPrice, sellConditionLabel, type SellDraft, type SellSection } from "@/lib/sell-flow"
import { fontFamily, useReswellColors } from "@/theme"

export function SellReviewStep({
  section,
  draft,
  signedIn,
}: {
  section: SellSection
  draft: SellDraft
  signedIn: boolean
}) {
  const colors = useReswellColors()
  const fulfillment = [draft.localPickup ? "Local pickup" : null, draft.shipping ? "Shipping" : null]
    .filter((item): item is string => item != null)
    .join(" · ")

  return (
    <View style={styles.stack}>
      <View style={styles.photos}>
        {draft.photos.map((photo) => (
          <Image key={photo.id} source={{ uri: photo.uri }} style={[styles.photo, { backgroundColor: colors.image }]} contentFit="cover" />
        ))}
      </View>
      <ReviewLine label="Type" value={section.title} />
      <ReviewLine label="Title" value={draft.title.trim()} />
      <ReviewLine label="Condition" value={sellConditionLabel(draft.condition)} />
      <ReviewLine label="Description" value={draft.description.trim()} />
      <ReviewLine label="Price" value={formatSellPrice(draft.price)} />
      <ReviewLine label="Location" value={`${draft.city.trim()}, ${draft.state.trim()}`} />
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
