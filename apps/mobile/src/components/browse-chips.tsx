import { ScrollView, Pressable, StyleSheet, Text } from "react-native"
import {
  MOBILE_BOARD_STYLE_FILTERS,
  MOBILE_CATEGORY_CHIPS,
  type MobileBoardType,
  type MobileListingCategory,
} from "@reswell/api-contract"
import { fontFamily, useReswellColors } from "@/theme"

<<<<<<< Updated upstream
export function BrowseChips({ onOpenCategory }: { onOpenCategory: (chip: MobileBrowseChip) => void }) {
=======
function ChipRow({
  chips,
  selectedKey,
  onPress,
  placement,
}: {
  chips: readonly { key: string; label: string }[]
  selectedKey: string | null
  onPress: (key: string) => void
  placement: "category" | "category-above-filter" | "filter"
}) {
>>>>>>> Stashed changes
  const colors = useReswellColors()
  const rowStyle =
    placement === "filter"
      ? styles.filterRow
      : placement === "category-above-filter"
        ? styles.categoryAboveFilter
        : styles.categoryRow

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroller}
      contentContainerStyle={rowStyle}
    >
<<<<<<< Updated upstream
      {MOBILE_BROWSE_CHIPS.map((chip) => {
=======
      {chips.map((chip) => {
        const active = selectedKey === chip.key
>>>>>>> Stashed changes
        return (
          <Pressable
            key={chip.key}
            accessibilityRole="button"
<<<<<<< Updated upstream
            onPress={() => onOpenCategory(chip)}
=======
            accessibilityState={{ selected: active }}
            onPress={() => onPress(chip.key)}
>>>>>>> Stashed changes
            style={[
              styles.chip,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.label, { color: colors.foreground, fontFamily: fontFamily.text }]}>
              {chip.label}
            </Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

/** Website header rail: Surfboards, Fins, Traction, Wetsuits, Apparel, Magazines. */
export function CategorySlider({
  selected,
  onSelect,
  trailing,
}: {
  selected: MobileListingCategory | null
  onSelect: (next: MobileListingCategory | null) => void
  /** Shape filters sit under this row, so the gap below the categories tightens. */
  trailing?: boolean
}) {
  return (
    <ChipRow
      placement={trailing ? "category-above-filter" : "category"}
      selectedKey={selected}
      chips={MOBILE_CATEGORY_CHIPS.map((chip) => ({ key: chip.category, label: chip.label }))}
      onPress={(key) => onSelect(selected === key ? null : (key as MobileListingCategory))}
    />
  )
}

/** Website board-style facet. Only shown while Surfboards is the active category. */
export function BoardStyleFilter({
  selected,
  onSelect,
}: {
  selected: MobileBoardType | null
  onSelect: (next: MobileBoardType | null) => void
}) {
  return (
    <ChipRow
      placement="filter"
      selectedKey={selected}
      chips={MOBILE_BOARD_STYLE_FILTERS.map((chip) => ({ key: chip.board_type, label: chip.label }))}
      onPress={(key) => onSelect(selected === key ? null : (key as MobileBoardType))}
    />
  )
}

const styles = StyleSheet.create({
  scroller: { flexGrow: 0 },
  categoryRow: {
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  categoryAboveFilter: {
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  filterRow: {
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 12,
  },
  chip: {
    minHeight: 36,
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  label: { fontSize: 13, fontWeight: "600", lineHeight: 16 },
})
