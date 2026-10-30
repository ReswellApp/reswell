import * as ImagePicker from "expo-image-picker"
import { Image } from "expo-image"
import { useEffect, useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { SymbolView } from "expo-symbols"
import { SellBoardSpecs } from "@/components/sell/sell-board-specs"
import { SellPhotoEditor } from "@/components/sell/sell-photo-editor"
import { SellPhotoTips } from "@/components/sell/sell-photo-tips"
import { SellUploadMenu } from "@/components/sell/sell-upload-menu"
import { HorizontalRail } from "@/components/horizontal-rail"
import { SellVideoAddTile, SellVideoFilledTile } from "@/components/sell/sell-video-tile"
import { fetchSellPhotoGuide } from "@/lib/api"
import { MAX_SELL_PHOTOS, type SellPhoto, type SellVideo } from "@/lib/sell-flow"
import { LISTING_VIDEO_MAX_DURATION_SECONDS, sellVideoFromPickerAsset } from "@/lib/sell-video"
import type { MobileSellBoardSpecs } from "@reswell/api-contract"
import { fontFamily, useReswellColors } from "@/theme"

export function SellPhotosStep({
  photos,
  video,
  boardSpecs,
  specValues,
  specsError,
  onRetrySpecs,
  onChange,
  onVideoChange,
  onVideoRetry,
  onSpecsChange,
}: {
  photos: SellPhoto[]
  video: SellVideo | null
  boardSpecs?: MobileSellBoardSpecs | null
  specValues?: Record<string, string>
  specsError?: string | null
  onRetrySpecs?: () => void
  onChange: (photos: SellPhoto[]) => void
  onVideoChange: (video: SellVideo | null) => void
  onVideoRetry?: () => void
  onSpecsChange?: (specs: Record<string, string>) => void
}) {
  const colors = useReswellColors()
  const [error, setError] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState<"photo" | "video" | null>(null)
  const [guideOpen, setGuideOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const room = MAX_SELL_PHOTOS - photos.length
  const editing = photos.find((photo) => photo.id === editingId) ?? null

  useEffect(() => {
    void fetchSellPhotoGuide()
  }, [])

  function saveEdit(uri: string) {
    if (!editing) return
    onChange(photos.map((photo) => (photo.id === editing.id ? { id: photo.id, uri } : photo)))
    setEditingId(null)
  }

  async function addFromLibrary() {
    if (room <= 0) return
    setMenuOpen(null)
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
    setMenuOpen(null)
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

  async function addVideoFromLibrary() {
    setMenuOpen(null)
    setError(null)
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      setError("Photo access is off. Enable it in Settings to add a listing video.")
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
      allowsMultipleSelection: false,
      videoMaxDuration: LISTING_VIDEO_MAX_DURATION_SECONDS,
    })
    if (result.canceled) return
    const asset = result.assets[0]
    if (!asset) return
    try {
      onVideoChange(await sellVideoFromPickerAsset(asset))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't add that video")
    }
  }

  async function recordVideo() {
    setMenuOpen(null)
    setError(null)
    const permission = await ImagePicker.requestCameraPermissionsAsync()
    if (!permission.granted) {
      setError("Camera access is off. Enable it in Settings to record a listing video.")
      return
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["videos"],
      videoMaxDuration: LISTING_VIDEO_MAX_DURATION_SECONDS,
    })
    if (result.canceled) return
    const asset = result.assets[0]
    if (!asset) return
    try {
      onVideoChange(await sellVideoFromPickerAsset(asset))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't add that video")
    }
  }

  return (
    <View style={styles.stack}>
      <View style={styles.photosHeader}>
        <Text style={[styles.photosTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
          Add photos (up to {MAX_SELL_PHOTOS})
        </Text>
        <Pressable accessibilityRole="button" onPress={() => setGuideOpen(true)} hitSlop={8}>
          <Text style={[styles.tipsLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>View photo guide</Text>
        </Pressable>
      </View>
      <HorizontalRail contentStyle={styles.rail}>
        {photos.map((photo) => (
          <View key={photo.id} style={styles.tile}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit photo"
              onPress={() => setEditingId(photo.id)}
              style={styles.editHit}
            >
              <Image source={{ uri: photo.uri }} style={[styles.image, { backgroundColor: colors.image }]} contentFit="cover" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Remove photo"
              onPress={() => onChange(photos.filter((item) => item.id !== photo.id))}
              style={styles.remove}
            >
              <SymbolView
                name={{ ios: "xmark.circle.fill", android: "cancel", web: "cancel" }}
                size={20}
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
            onPress={() => setMenuOpen("photo")}
            style={[styles.tile, styles.empty, { borderColor: colors.foreground, backgroundColor: colors.image }]}
          >
            <Text style={[styles.plus, { color: colors.muted }]}>+</Text>
          </Pressable>
        ))}
        {video ? (
          <SellVideoFilledTile video={video} onRemove={() => onVideoChange(null)} onRetry={onVideoRetry} />
        ) : (
          <SellVideoAddTile onPress={() => setMenuOpen("video")} />
        )}
      </HorizontalRail>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          const first = photos[0]
          if (first) setEditingId(first.id)
          else setMenuOpen("photo")
        }}
        hitSlop={8}
        style={styles.editPhotos}
      >
        <Text style={[styles.editPhotosLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>Edit photos</Text>
      </Pressable>
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
      {menuOpen === "photo" ? (
        <SellUploadMenu onLibrary={() => void addFromLibrary()} onCamera={() => void takePhoto()} onClose={() => setMenuOpen(null)} />
      ) : null}
      {menuOpen === "video" ? (
        <SellUploadMenu
          title="Add a video"
          libraryLabel="Video Library"
          cameraLabel="Record Video"
          libraryIcon={{ ios: "film", android: "videocam" }}
          cameraIcon={{ ios: "video", android: "videocam" }}
          onLibrary={() => void addVideoFromLibrary()}
          onCamera={() => void recordVideo()}
          onClose={() => setMenuOpen(null)}
        />
      ) : null}
      {editing ? <SellPhotoEditor uri={editing.uri} onCancel={() => setEditingId(null)} onSave={saveEdit} /> : null}
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
  stack: { gap: 12 },
  photosHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  photosTitle: { flex: 1, fontSize: 16, fontWeight: "700" },
  tipsLabel: { fontSize: 13, fontWeight: "600", textDecorationLine: "underline" },
  rail: { gap: 10, paddingRight: 4 },
  tile: { width: 112, aspectRatio: 3 / 4, borderRadius: 10, overflow: "hidden" },
  empty: {
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  plus: { fontSize: 24, fontWeight: "500" },
  image: { width: "100%", height: "100%" },
  editHit: { width: "100%", height: "100%" },
  remove: { position: "absolute", top: 6, right: 6 },
  editPhotos: { alignSelf: "flex-start", minHeight: 36, justifyContent: "center" },
  editPhotosLabel: { fontSize: 13, fontWeight: "600", textDecorationLine: "underline" },
  error: { fontSize: 15 },
})
