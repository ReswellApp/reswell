import { SymbolView } from "expo-symbols"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { ListingLayoutSwitch, type ListingLayout } from "@/components/listing-layout-switch"
import { fontFamily, useReswellColors } from "@/theme"

export function CategoryToolbar({
  sortLabel,
  filterCount,
  layout,
  onSort,
  onFilter,
  onLayout,
}: {
  sortLabel: string
  filterCount: number
  layout: ListingLayout
  onSort: () => void
  onFilter: () => void
  onLayout: (next: ListingLayout) => void
}) {
  const colors = useReswellColors()
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        onPress={onSort}
        style={[styles.sort, { backgroundColor: colors.image }]}
      >
        <Text numberOfLines={1} style={[styles.sortLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>
          {sortLabel}
        </Text>
        <SymbolView name={{ ios: "chevron.down", android: "expand_more", web: "expand_more" }} size={16} tintColor={colors.foreground} />
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onFilter} hitSlop={8} style={styles.filter}>
        <SymbolView
          name={{ ios: "slider.horizontal.3", android: "tune", web: "tune" }}
          size={22}
          tintColor={colors.foreground}
        />
        {filterCount > 0 ? (
          <View style={[styles.badge, { backgroundColor: colors.foreground }]}>
            <Text style={[styles.badgeLabel, { color: colors.primaryForeground }]}>{filterCount}</Text>
          </View>
        ) : null}
      </Pressable>
      <ListingLayoutSwitch layout={layout} onLayout={onLayout} />
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  sort: {
    flex: 1,
    minHeight: 44,
    borderRadius: 22,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  sortLabel: { fontSize: 15, fontWeight: "700" },
  filter: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  badge: {
    position: "absolute",
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeLabel: { fontSize: 10, fontWeight: "700" },
})
