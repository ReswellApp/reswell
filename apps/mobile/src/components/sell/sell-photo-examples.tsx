import type { MobileSellPhotoGuideExample } from "@reswell/api-contract"
import { Image } from "expo-image"
import { SymbolView, type AndroidSymbol, type SFSymbol } from "expo-symbols"
import { useEffect, useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { fetchSellPhotoGuide } from "@/lib/api"
import { fontFamily, useReswellColors } from "@/theme"

const FALLBACK: { id: string; label: string; ios: SFSymbol; android: AndroidSymbol }[] = [
  { id: "primary", label: "Primary", ios: "photo", android: "photo" },
  { id: "bottom", label: "Bottom", ios: "square.on.square", android: "filter_none" },
  { id: "rails", label: "Rails", ios: "magnifyingglass", android: "search" },
  { id: "tail-fins", label: "Tail & fins", ios: "person", android: "person" },
  { id: "size-scale", label: "Size and scale", ios: "ruler", android: "straighten" },
  { id: "imperfections", label: "Imperfections", ios: "exclamationmark.circle", android: "error_outline" },
]

function fallbackFor(id: string) {
  return FALLBACK.find((example) => example.id === id) ?? FALLBACK[0]
}

export function SellPhotoExampleGrid() {
  const colors = useReswellColors()
  const [examples, setExamples] = useState<MobileSellPhotoGuideExample[] | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchSellPhotoGuide()
      .then((guide) => {
        if (!cancelled) setExamples(guide.examples)
      })
      .catch(() => {
        if (!cancelled) setExamples([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const photos = examples && examples.length > 0 ? examples : null
  const tiles = photos ?? FALLBACK

  return (
    <View style={styles.grid}>
      {tiles.map((example) => {
        const imageUrl = "image_url" in example ? example.image_url : null
        const icon = fallbackFor(example.id)
        return (
          <View key={example.id} style={[styles.card, { borderColor: colors.border, backgroundColor: colors.image }]}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : examples === null ? null : (
              <SymbolView
                name={{ ios: icon.ios, android: icon.android, web: icon.android }}
                size={28}
                tintColor={colors.muted}
              />
            )}
            <View style={styles.labelBar}>
              <Text style={[styles.label, { color: "#FFFFFF", fontFamily: fontFamily.text }]}>{example.label}</Text>
            </View>
          </View>
        )
      })}
    </View>
  )
}

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
      {open ? <SellPhotoExampleGrid /> : null}
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
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  labelBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 4,
    paddingBottom: 6,
    paddingTop: 16,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  label: { fontSize: 11, fontWeight: "600", textAlign: "center" },
})
