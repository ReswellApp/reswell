import { Pressable, StyleSheet, Text, View } from "react-native"
import type { OffersRoleFilter } from "@/lib/offer-display"
import { fontFamily, useReswellColors } from "@/theme"

const FILTERS: { id: OffersRoleFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "received", label: "Received" },
  { id: "sent", label: "Sent" },
]

export function OfferRoleFilters({
  activeFilter,
  receivedCount,
  sentCount,
  onChange,
}: {
  activeFilter: OffersRoleFilter
  receivedCount: number
  sentCount: number
  onChange: (filter: OffersRoleFilter) => void
}) {
  const colors = useReswellColors()

  return (
    <View style={[styles.track, { backgroundColor: colors.secondary }]}>
      {FILTERS.map((filter) => {
        const selected = filter.id === activeFilter
        const count = filter.id === "received" ? receivedCount : filter.id === "sent" ? sentCount : null
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
