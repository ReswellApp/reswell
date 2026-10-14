import * as ImagePicker from "expo-image-picker"
import { Image } from "expo-image"
import { useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { SymbolView } from "expo-symbols"
import { SellBoardSpecs } from "@/components/sell/sell-board-specs"
import { SellPhotoExamples } from "@/components/sell/sell-photo-examples"
import { SellPhotoTips } from "@/components/sell/sell-photo-tips"
import { SellUploadMenu } from "@/components/sell/sell-upload-menu"
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
  const [tipsOpen, setTipsOpen] = useState(false)
  const [examplesOpen, setExamplesOpen] = useState(true)
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
      <Text style={[styles.heading, { color: colors.foreground, fontFamily: fontFamily.text }]}>
        Upload photos of your gear
        <Text style={[styles.required, { color: colors.destructive }]}> *</Text>
      </Text>
      <Text style={[styles.copy, { color: colors.muted, fontFamily: fontFamily.text }]}>
        Use photos you took. Screenshots and pictures from other sites or manufacturers aren’t allowed. Square photos
        are best. Up to {MAX_SELL_PHOTOS}.
      </Text>
      <Pressable accessibilityRole="button" onPress={() => setTipsOpen(true)} style={styles.tipsLink}>
        <Text style={[styles.tipsLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>
          Tips for top-notch photos
        </Text>
        <SymbolView name={{ ios: "info.circle", android: "info", web: "info" }} size={16} tintColor={colors.foreground} />
      </Pressable>
      {photos.length > 0 ? (
        <View style={styles.grid}>
          {photos.map((photo) => (
            <View key={photo.id} style={styles.tile}>
              <Image source={{ uri: photo.uri }} style={styles.image} contentFit="cover" />
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
        </View>
      ) : null}
      {room > 0 ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setMenuOpen(true)}
          style={[styles.upload, { borderColor: colors.muted, backgroundColor: colors.image }]}
        >
          <Text style={[styles.uploadLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>+ Upload Photo</Text>
        </Pressable>
      ) : null}
      {error ? <Text style={[styles.error, { color: colors.destructive, fontFamily: fontFamily.text }]}>{error}</Text> : null}
      <SellPhotoExamples open={examplesOpen} onToggle={() => setExamplesOpen((open) => !open)} />
      {boardSpecs !== undefined ? (
        <SellBoardSpecs
          specs={boardSpecs}
          values={specValues ?? {}}
          error={specsError ?? null}
          onRetry={onRetrySpecs ?? (() => undefined)}
          onChange={onSpecsChange ?? (() => undefined)}
        />
      ) : null}
      {tipsOpen ? <SellPhotoTips onClose={() => setTipsOpen(false)} /> : null}
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
  heading: { fontSize: 17, fontWeight: "700" },
  required: { fontWeight: "700" },
  copy: { fontSize: 15, lineHeight: 21, marginTop: -6 },
  tipsLink: { flexDirection: "row", alignItems: "center", gap: 6 },
  tipsLabel: { fontSize: 15, fontWeight: "600", textDecorationLine: "underline" },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 8 },
  tile: { width: "31%", aspectRatio: 1, borderRadius: 8, overflow: "hidden" },
  image: { width: "100%", height: "100%" },
  remove: { position: "absolute", top: 6, right: 6 },
  upload: {
    minHeight: 64,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  uploadLabel: { fontSize: 16, fontWeight: "600" },
  error: { fontSize: 15 },
})
