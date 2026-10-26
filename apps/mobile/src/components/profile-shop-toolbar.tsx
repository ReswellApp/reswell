import { SymbolView } from "expo-symbols"
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import { fontFamily, useReswellColors } from "@/theme"

export function ProfileShopToolbar({
  sellerName,
  query,
  onQueryChange,
}: {
  sellerName: string
  query: string
  onQueryChange: (value: string) => void
}) {
  const colors = useReswellColors()
  const placeholder = `Search ${sellerName.split(/\s+/)[0] ?? "seller"}'s shop…`
  return (
    <View style={styles.row}>
      <View style={[styles.field, { borderColor: colors.border, backgroundColor: colors.background }]}>
        <SymbolView name={{ ios: "magnifyingglass", android: "search", web: "search" }} size={16} tintColor={colors.muted} />
        <TextInput
          value={query}
          onChangeText={onQueryChange}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          style={[styles.input, { color: colors.foreground, fontFamily: fontFamily.text }]}
        />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sort listings"
        style={[styles.sort, { borderColor: colors.border, backgroundColor: colors.background }]}
      >
        <Text style={[styles.sortLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>Recent</Text>
        <SymbolView name={{ ios: "chevron.down", android: "expand_more", web: "expand_more" }} size={14} tintColor={colors.muted} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  field: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 40,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
  },
  input: { flex: 1, fontSize: 15, paddingVertical: 8 },
  sort: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    minHeight: 40,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
  },
  sortLabel: { fontSize: 14, fontWeight: "600" },
})
