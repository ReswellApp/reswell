import { SymbolView } from "expo-symbols"
import { Pressable, StyleSheet, View } from "react-native"
import { useReswellColors } from "@/theme"

export type ListingLayout = "grid" | "list"

/** List (one listing) and grid (two listings) control used on category and feed screens. */
export function ListingLayoutSwitch({
  layout,
  onLayout,
}: {
  layout: ListingLayout
  onLayout: (next: ListingLayout) => void
}) {
  const colors = useReswellColors()
  return (
    <View style={[styles.switch, { backgroundColor: colors.image }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Single listing"
        accessibilityState={{ selected: layout === "list" }}
        onPress={() => onLayout("list")}
        style={[styles.switchItem, layout === "list" && { backgroundColor: colors.background }]}
      >
        <SymbolView name={{ ios: "list.bullet", android: "view_list", web: "view_list" }} size={18} tintColor={colors.foreground} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Double listing"
        accessibilityState={{ selected: layout === "grid" }}
        onPress={() => onLayout("grid")}
        style={[styles.switchItem, layout === "grid" && { backgroundColor: colors.background }]}
      >
        <SymbolView
          name={{ ios: "square.grid.2x2.fill", android: "grid_view", web: "grid_view" }}
          size={18}
          tintColor={colors.foreground}
        />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  switch: { flexDirection: "row", borderRadius: 22, padding: 3 },
  switchItem: { width: 36, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
})
