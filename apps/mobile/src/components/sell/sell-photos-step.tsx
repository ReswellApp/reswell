import * as ImagePicker from "expo-image-picker"
import { Image } from "expo-image"
import { useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { SymbolView } from "expo-symbols"
import { SellBoardSpecs } from "@/components/sell/sell-board-specs"
import { SellPhotoTips } from "@/components/sell/sell-photo-tips"
import { SellUploadMenu } from "@/components/sell/sell-upload-menu"
import { HorizontalRail } from "@/components/horizontal-rail"
import { MAX_SELL_PHOTOS, type SellPhoto } from "@/lib/sell-flow"
import type { MobileSellBoardSpecs } from "@reswell/api-contract"
import { fontFamily, useReswellColors } from "@/theme"

export function SellPhotosStep({
  photos,
  boardSpecs,
  specValues,
  specsError,
  onRetrySpecs,
  onChange,
  onSpecsChange,
}: {
  photos: SellPhoto[]
  boardSpecs?: MobileSellBoardSpecs | null
  specValues?: Record<string, string>
  specsError?: string | null
  onRetrySpecs?: () => void
  onChange: (photos: SellPhoto[]) => void
  onSpecsChange?: (specs: Record<string, string>) => void
}) {
  const colors = useReswellColors()
  const [error, setError] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const room = MAX_SELL_PHOTOS - photos.length

  async function addFromLibrary() {
    if (room <= 0) return
    setMenuOpen(false)
    setError(null)
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      setError("Photo access is off. Enable it in Settings to add listing photos.")
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: room,
      quality: 0.8,
    })
    if (result.canceled) return
    onChange([...photos, ...toPhotos(result.assets)].slice(0, MAX_SELL_PHOTOS))
  }

  async function takePhoto() {
    if (room <= 0) return
    setMenuOpen(false)
    setError(null)
    const permission = await ImagePicker.requestCameraPermissionsAsync()
    if (!permission.granted) {
      setError("Camera access is off. Enable it in Settings to take a listing photo.")
      return
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 })
    if (result.canceled) return
    onChange([...photos, ...toPhotos(result.assets)].slice(0, MAX_SELL_PHOTOS))
  }

  return (
    <View style={styles.stack}>
      <Pressable accessibilityRole="button" onPress={() => setGuideOpen(true)} style={styles.tipsLink}>
        <Text style={[styles.tipsLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>View photo guide</Text>
      </Pressable>
      <HorizontalRail contentStyle={styles.rail}>
        {photos.map((photo) => (
          <View key={photo.id} style={styles.tile}>
            <Image source={{ uri: photo.uri }} style={[styles.image, { backgroundColor: colors.image }]} contentFit="cover" />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Remove photo"
              onPress={() => onChange(photos.filter((item) => item.id !== photo.id))}
              style={styles.remove}
            >
              <SymbolView
                name={{ ios: "xmark.circle.fill", android: "cancel", web: "cancel" }}
                size={22}
                tintColor="#FFFFFF"
              />
            </Pressable>
          </View>
        ))}
        {Array.from({ length: room }, (_, index) => (
          <Pressable
            key={`empty-${index}`}
            accessibilityRole="button"
            accessibilityLabel="Add photo"
            onPress={() => setMenuOpen(true)}
            style={[styles.tile, styles.empty, { borderColor: colors.border, backgroundColor: colors.image }]}
          >
            <Text style={[styles.plus, { color: colors.muted }]}>+</Text>
          </Pressable>
        ))}
      </HorizontalRail>
      {error ? <Text style={[styles.error, { color: colors.destructive, fontFamily: fontFamily.text }]}>{error}</Text> : null}
      {boardSpecs !== undefined ? (
        <SellBoardSpecs
          specs={boardSpecs}
          values={specValues ?? {}}
          error={specsError ?? null}
          onRetry={onRetrySpecs ?? (() => undefined)}
          onChange={onSpecsChange ?? (() => undefined)}
        />
      ) : null}
      {guideOpen ? <SellPhotoTips onClose={() => setGuideOpen(false)} /> : null}
      {menuOpen ? (
        <SellUploadMenu onLibrary={() => void addFromLibrary()} onCamera={() => void takePhoto()} onClose={() => setMenuOpen(false)} />
      ) : null}
    </View>
  )
}

function toPhotos(assets: ImagePicker.ImagePickerAsset[]): SellPhoto[] {
  return assets.map((asset, index) => ({
    id: `${asset.assetId ?? asset.uri}-${index}-${Date.now()}`,
    uri: asset.uri,
  }))
}

const styles = StyleSheet.create({
  stack: { gap: 14 },
  tipsLink: { flexDirection: "row", alignItems: "center", gap: 6 },
  tipsLabel: { fontSize: 15, fontWeight: "600", textDecorationLine: "underline" },
  rail: { gap: 12, paddingRight: 4 },
  /** Same width and crop as a homepage listing tile. */
  tile: { width: 168, aspectRatio: 3 / 4, borderRadius: 12, overflow: "hidden" },
  empty: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  plus: { fontSize: 32, fontWeight: "500" },
  image: { width: "100%", height: "100%" },
  remove: { position: "absolute", top: 8, right: 8 },
  error: { fontSize: 15 },
})
