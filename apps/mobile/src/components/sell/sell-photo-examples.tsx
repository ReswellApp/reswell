import { SymbolView, type AndroidSymbol, type SFSymbol } from "expo-symbols"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { fontFamily, useReswellColors } from "@/theme"

const EXAMPLES: { label: string; ios: SFSymbol; android: AndroidSymbol }[] = [
  { label: "Primary", ios: "photo", android: "photo" },
  { label: "Every angle", ios: "square.on.square", android: "filter_none" },
  { label: "Details", ios: "magnifyingglass", android: "search" },
  { label: "In use", ios: "person", android: "person" },
  { label: "Size and scale", ios: "ruler", android: "straighten" },
  { label: "Imperfections", ios: "exclamationmark.circle", android: "error_outline" },
]

export function SellPhotoExamples({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const colors = useReswellColors()

  return (
    <View style={styles.stack}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: fontFamily.text }]}>Examples</Text>
        <Pressable accessibilityRole="button" onPress={onToggle}>
          <Text style={[styles.hide, { color: colors.muted, fontFamily: fontFamily.text }]}>{open ? "Hide" : "Show"}</Text>
        </Pressable>
      </View>
      {open ? (
        <View style={styles.grid}>
          {EXAMPLES.map((example) => (
            <View key={example.label} style={[styles.card, { borderColor: colors.border }]}>
              <SymbolView
                name={{ ios: example.ios, android: example.android, web: example.android }}
                size={28}
                tintColor={colors.muted}
              />
              <Text style={[styles.label, { color: colors.foreground, fontFamily: fontFamily.text }]}>{example.label}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  stack: { gap: 12, marginTop: 8 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 16, fontWeight: "700" },
  hide: { fontSize: 15 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10 },
  card: {
    width: "31%",
    aspectRatio: 1,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 8,
  },
  label: { fontSize: 12, textAlign: "center" },
})
