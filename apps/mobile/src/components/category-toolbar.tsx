import { SymbolView } from "expo-symbols"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { ListingLayoutSwitch, type ListingLayout } from "@/components/listing-layout-switch"
import { ReswellFilterIcon } from "@/components/reswell-icons"
import { fontFamily, useReswellColors } from "@/theme"

/** Circular filter, Sort by pill, and result count. Shared by category and search. */
export function CategoryToolbar({
  count,
  filterCount,
  onSort,
  onFilter,
  layout,
  onLayout,
}: {
  count: number
  filterCount: number
  onSort: () => void
  onFilter: () => void
  layout?: ListingLayout
  onLayout?: (next: ListingLayout) => void
}) {
  const colors = useReswellColors()
  return (
    <View style={styles.block}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Filter"
          onPress={onFilter}
          style={[styles.filter, { backgroundColor: colors.image }]}
        >
          <ReswellFilterIcon />
          {filterCount > 0 ? (
            <View style={[styles.badge, { backgroundColor: colors.foreground }]}>
              <Text style={[styles.badgeLabel, { color: colors.primaryForeground }]}>{filterCount}</Text>
            </View>
          ) : null}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sort by"
          onPress={onSort}
          style={[styles.sort, { backgroundColor: colors.image }]}
        >
          <Text style={[styles.sortLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>Sort by</Text>
          <SymbolView
            name={{ ios: "chevron.down", android: "expand_more", web: "expand_more" }}
            size={16}
            tintColor={colors.foreground}
          />
        </Pressable>
        {layout && onLayout ? (
          <View style={styles.layout}>
            <ListingLayoutSwitch layout={layout} onLayout={onLayout} />
          </View>
        ) : null}
      </View>
      <Text style={[styles.count, { color: colors.muted, fontFamily: fontFamily.text }]}>
        {count} {count === 1 ? "result" : "results"}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  block: { paddingHorizontal: 4, paddingTop: 14, paddingBottom: 12, gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  layout: { marginLeft: "auto" },
  filter: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  sort: {
    minHeight: 44,
    borderRadius: 22,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sortLabel: { fontSize: 15, fontWeight: "700" },
  badge: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeLabel: { fontSize: 10, fontWeight: "700" },
  count: { fontSize: 14 },
})
