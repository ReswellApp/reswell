import { StyleSheet, Text, View } from "react-native"
import { MOBILE_BOARD_STYLE_FILTERS, type MobileListingDetail } from "@reswell/api-contract"
import { fontFamily, useReswellColors } from "@/theme"

function shapeLabel(boardType: string | null): string | null {
  if (!boardType || boardType === "other") return null
  return MOBILE_BOARD_STYLE_FILTERS.find((item) => item.board_type === boardType)?.label ?? null
}

export function listingSpecRows(listing: MobileListingDetail): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = []
  if (listing.condition_line) rows.push({ label: "Condition", value: listing.condition_line })
  const shape = shapeLabel(listing.board_type)
  if (shape) rows.push({ label: "Shape", value: shape })
  if (listing.dimensions) rows.push({ label: "Dimensions", value: listing.dimensions })
  if (listing.volume_label) rows.push({ label: "Volume", value: listing.volume_label })
  return rows
}

export function ListingSpecTable({ rows }: { rows: { label: string; value: string }[] }) {
  const colors = useReswellColors()
  if (rows.length === 0) return null
  return (
    <View style={[styles.specs, { borderColor: colors.border }]}>
      {rows.map((row, index) => (
        <View
          key={row.label}
          style={[
            styles.specRow,
            index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border } : null,
          ]}
        >
          <Text style={[styles.specLabel, { color: colors.muted, fontFamily: fontFamily.text }]}>{row.label}</Text>
          <Text style={[styles.specValue, { color: colors.foreground, fontFamily: fontFamily.text }]}>{row.value}</Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  specs: { marginTop: 4, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  specRow: { flexDirection: "row", alignItems: "baseline", gap: 16, paddingVertical: 8 },
  specLabel: { width: 116, fontSize: 13, fontWeight: "500" },
  specValue: { flex: 1, fontSize: 13, lineHeight: 18 },
})
