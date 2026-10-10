import * as ImagePicker from "expo-image-picker"
import { Image } from "expo-image"
import { SymbolView } from "expo-symbols"
import { useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { MAX_SELL_PHOTOS, type SellPhoto } from "@/lib/sell-flow"
import { fontFamily, useReswellColors } from "@/theme"

export function SellPhotosStep({
  photos,
  onChange,
}: {
  photos: SellPhoto[]
  onChange: (photos: SellPhoto[]) => void
}) {
  const colors = useReswellColors()
  const [error, setError] = useState<string | null>(null)
  const room = MAX_SELL_PHOTOS - photos.length

  async function addFromLibrary() {
    if (room <= 0) return
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
    setError(null)
    const permission = await ImagePicker.requestCameraPermissionsAsync()
    if (!permission.granted) {
      setError("Camera access is off. Enable it in Settings to take a listing photo.")
      return
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    })
    if (result.canceled) return
    onChange([...photos, ...toPhotos(result.assets)].slice(0, MAX_SELL_PHOTOS))
  }

  return (
    <View style={styles.stack}>
      <Text style={[styles.hint, { color: colors.muted, fontFamily: fontFamily.text }]}>
        Add at least one photo. Up to {MAX_SELL_PHOTOS}.
      </Text>
      {photos.length === 0 ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void addFromLibrary()}
          style={[styles.well, { backgroundColor: colors.image }]}
        >
          <SymbolView
            name={{ ios: "photo.on.rectangle.angled", android: "photo_library", web: "photo_library" }}
            size={28}
            tintColor={colors.foreground}
          />
          <Text style={[styles.wellLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>Add photos</Text>
        </Pressable>
      ) : (
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
      )}
      <View style={styles.actions}>
        {photos.length > 0 && room > 0 ? (
          <Pressable accessibilityRole="button" onPress={() => void addFromLibrary()}>
            <Text style={[styles.action, { color: colors.foreground, fontFamily: fontFamily.text }]}>Add photos</Text>
          </Pressable>
        ) : null}
        {room > 0 ? (
          <Pressable accessibilityRole="button" onPress={() => void takePhoto()}>
            <Text style={[styles.action, { color: colors.foreground, fontFamily: fontFamily.text }]}>Take a photo</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={[styles.error, { color: colors.destructive, fontFamily: fontFamily.text }]}>{error}</Text> : null}
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
  stack: { gap: 16 },
  hint: { fontSize: 15 },
  well: { height: 180, borderRadius: 8, alignItems: "center", justifyContent: "center", gap: 8 },
  wellLabel: { fontSize: 16, fontWeight: "600" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: { width: "31%", aspectRatio: 1, borderRadius: 8, overflow: "hidden" },
  image: { width: "100%", height: "100%" },
  remove: { position: "absolute", top: 6, right: 6 },
  actions: { flexDirection: "row", gap: 20 },
  action: { fontSize: 16, fontWeight: "600" },
  error: { fontSize: 15 },
})
