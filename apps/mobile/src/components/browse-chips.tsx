import { ScrollView, Pressable, StyleSheet, Text } from "react-native"
import {
  MOBILE_BOARD_STYLE_FILTERS,
  MOBILE_CATEGORY_CHIPS,
  type MobileBoardType,
  type MobileListingCategory,
} from "@reswell/api-contract"
import { fontFamily, useReswellColors } from "@/theme"

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
      {chips.map((chip) => {
        const active = selectedKey === chip.key
        return (
          <Pressable
            key={chip.key}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onPress(chip.key)}
            style={[
              styles.chip,
              {
                backgroundColor: active ? colors.image : colors.background,
                borderColor: active ? colors.foreground : colors.border,
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

/** Website header rail. Opens a category page. */
export function CategorySlider({
  onOpenCategory,
}: {
  onOpenCategory: (category: MobileListingCategory) => void
}) {
  return (
    <ChipRow
      placement="category"
      selectedKey={null}
      chips={MOBILE_CATEGORY_CHIPS.map((chip) => ({ key: chip.category, label: chip.label }))}
      onPress={(key) => onOpenCategory(key as MobileListingCategory)}
    />
  )
}

/** Website board-style facet. Shown on the Surfboards category. */
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
    paddingTop: 4,
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
