import type { MobileSellPhotoGuideExample } from "@reswell/api-contract"
import { Image } from "expo-image"
import { SymbolView, type AndroidSymbol, type SFSymbol } from "expo-symbols"
import { useEffect, useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { LISTING_TILE_ASPECT } from "@/components/listing-list-layout"
import { fetchSellPhotoGuide } from "@/lib/api"
import { publicSiteUrl } from "@/lib/public-env"
import { fontFamily, useReswellColors } from "@/theme"

const FALLBACK: { id: string; label: string; ios: SFSymbol; android: AndroidSymbol }[] = [
  { id: "primary", label: "Primary", ios: "photo", android: "photo" },
  { id: "bottom", label: "Bottom", ios: "square.on.square", android: "filter_none" },
  { id: "rails", label: "Rails", ios: "magnifyingglass", android: "search" },
  { id: "tail-fins", label: "Tail & fins", ios: "person", android: "person" },
  { id: "size-scale", label: "Size and scale", ios: "ruler", android: "straighten" },
  { id: "imperfections", label: "Imperfections", ios: "exclamationmark.circle", android: "error_outline" },
]

/** Same six `/media/listings/…-card2.webp` shots as website `/sell`. */
const LISTING_MEDIA_PREFIX = "/media/listings/ab98fbb1-0c49-49e1-9483-a1c4a286c8e2"

function listingMediaUrl(path: string): string {
  const origin = publicSiteUrl().replace(/\/$/, "")
  return `${origin}${path}`
}

const DEFAULT_EXAMPLES: MobileSellPhotoGuideExample[] = [
  {
    id: "primary",
    label: "Primary",
    image_url: listingMediaUrl(`${LISTING_MEDIA_PREFIX}/1793147537223-99db0cdc-c68d-44a3-9de4-33a0c0fed05c-card2.webp`),
  },
  {
    id: "bottom",
    label: "Bottom",
    image_url: listingMediaUrl(`${LISTING_MEDIA_PREFIX}/1793147557461-c89bd6a0-5dd4-4c7f-917e-726fbc497534-card2.webp`),
  },
  {
    id: "rails",
    label: "Rails",
    image_url: listingMediaUrl(`${LISTING_MEDIA_PREFIX}/1793147536479-630701ee-7f5e-41ff-8f44-e9ff28cc8bdc-card2.webp`),
  },
  {
    id: "tail-fins",
    label: "Tail & fins",
    image_url: listingMediaUrl(`${LISTING_MEDIA_PREFIX}/1793147580367-f9daf750-fe5c-49e9-bb62-744e96340519-card2.webp`),
  },
  {
    id: "size-scale",
    label: "Size and scale",
    image_url: listingMediaUrl(`${LISTING_MEDIA_PREFIX}/1793147558963-0705b765-7f4e-4131-9717-b5ef7de1d041-card2.webp`),
  },
  {
    id: "imperfections",
    label: "Imperfections",
    image_url: listingMediaUrl(
      `${LISTING_MEDIA_PREFIX}/1793147559496-1555b593-f8b4-432d-a602-fffa239489af-card2.webp`,
    ),
  },
]

function fallbackFor(id: string) {
  return FALLBACK.find((example) => example.id === id) ?? FALLBACK[0]
}

export function SellPhotoExampleGrid() {
  const colors = useReswellColors()
  const [examples, setExamples] = useState<MobileSellPhotoGuideExample[]>(DEFAULT_EXAMPLES)
  const [failedIds, setFailedIds] = useState<ReadonlySet<string>>(() => new Set())

  useEffect(() => {
    let cancelled = false
    for (const example of DEFAULT_EXAMPLES) {
      Image.prefetch(example.image_url).catch(() => undefined)
    }
    fetchSellPhotoGuide()
      .then((guide) => {
        if (!cancelled && guide.examples.length > 0) setExamples(guide.examples)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <View style={styles.grid}>
      {examples.map((example) => {
        const imageUrl = failedIds.has(example.id) ? null : example.image_url
        const icon = fallbackFor(example.id)
        return (
          <View key={example.id} style={[styles.card, { borderColor: colors.border }]}>
            {imageUrl ? (
              <Image
                source={{ uri: imageUrl }}
                style={[styles.photo, { backgroundColor: colors.image }]}
                contentFit="cover"
                recyclingKey={imageUrl}
                onError={() => {
                  setFailedIds((current) => new Set(current).add(example.id))
                }}
              />
            ) : (
              <View style={[styles.photo, styles.placeholder, { backgroundColor: colors.image }]}>
                <SymbolView
                  name={{ ios: icon.ios, android: icon.android, web: icon.android }}
                  size={28}
                  tintColor={colors.muted}
                />
              </View>
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
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  photo: { width: "100%", aspectRatio: LISTING_TILE_ASPECT },
  placeholder: { alignItems: "center", justifyContent: "center" },
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
