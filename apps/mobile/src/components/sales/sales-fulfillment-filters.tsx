import { Pressable, StyleSheet, Text, View } from "react-native"
import type { SalesListFilter } from "@/lib/sale-display"
import { fontFamily, useReswellColors } from "@/theme"

const FILTERS: { id: SalesListFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending-shipment", label: "Pending shipment" },
  { id: "pending-pickup", label: "Pending pickup" },
]

export function SalesFulfillmentFilters({
  activeFilter,
  pendingShipmentCount,
  pendingPickupCount,
  onChange,
}: {
  activeFilter: SalesListFilter
  pendingShipmentCount: number
  pendingPickupCount: number
  onChange: (filter: SalesListFilter) => void
}) {
  const colors = useReswellColors()

  return (
    <View style={[styles.track, { backgroundColor: colors.secondary }]}>
      {FILTERS.map((filter) => {
        const selected = filter.id === activeFilter
        const count =
          filter.id === "pending-shipment"
            ? pendingShipmentCount
            : filter.id === "pending-pickup"
              ? pendingPickupCount
              : null
        const label = count == null ? filter.label : `${filter.label} (${count})`
        return (
          <Pressable
            key={filter.id}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={label}
            onPress={() => onChange(filter.id)}
            style={[styles.item, selected ? { backgroundColor: colors.background } : null]}
          >
            <Text
              style={[
                styles.label,
                {
                  color: selected ? colors.foreground : colors.muted,
                  fontFamily: fontFamily.text,
                  fontWeight: selected ? "700" : "500",
                },
              ]}
            >
              {label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  item: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  label: { fontSize: 13 },
})
