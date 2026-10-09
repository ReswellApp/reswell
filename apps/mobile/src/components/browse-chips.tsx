import { ScrollView, Pressable, StyleSheet, Text } from "react-native"
import { MOBILE_BROWSE_CHIPS, type MobileBrowseChip } from "@reswell/api-contract"
import { fontFamily, useReswellColors } from "@/theme"

export function BrowseChips({ onOpenCategory }: { onOpenCategory: (chip: MobileBrowseChip) => void }) {
  const colors = useReswellColors()

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroller}
      contentContainerStyle={styles.row}
    >
      {MOBILE_BROWSE_CHIPS.map((chip) => {
        return (
          <Pressable
            key={`${chip.category}:${chip.board_type ?? "all"}`}
            accessibilityRole="button"
            onPress={() => onOpenCategory(chip)}
            style={[
              styles.chip,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.label,
                {
                  color: colors.foreground,
                  fontFamily: fontFamily.text,
                },
              ]}
            >
              {chip.label}
            </Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroller: { flexGrow: 0 },
  row: {
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
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
