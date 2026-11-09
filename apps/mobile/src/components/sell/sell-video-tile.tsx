import { Image } from "expo-image"
import { SymbolView } from "expo-symbols"
import { Pressable, StyleSheet, Text, View } from "react-native"
import type { SellVideo } from "@/lib/sell-flow"
import { fontFamily, useReswellColors } from "@/theme"

export function SellVideoAddTile({ onPress }: { onPress: () => void }) {
  const colors = useReswellColors()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Add listing video"
      onPress={onPress}
      style={[styles.tile, styles.empty, { borderColor: colors.foreground, backgroundColor: colors.image }]}
    >
      <SymbolView
        name={{ ios: "video.badge.plus", android: "videocam", web: "videocam" }}
        size={22}
        tintColor={colors.foreground}
      />
      <Text style={[styles.addLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>Video</Text>
    </Pressable>
  )
}

export function SellVideoFilledTile({
  video,
  onRemove,
  onRetry,
}: {
  video: SellVideo
  onRemove: () => void
  onRetry?: () => void
}) {
  const colors = useReswellColors()
  const preview = video.thumbnailUri || video.thumbnailUrl
  const uploading = video.status === "uploading"
  const errored = video.status === "error"
  const progress =
    typeof video.uploadProgress === "number" ? Math.max(1, Math.min(99, Math.round(video.uploadProgress * 100))) : null

  return (
    <View style={styles.tile}>
      {preview ? (
        <Image source={{ uri: preview }} style={[styles.image, { backgroundColor: "#111111" }]} contentFit="cover" />
      ) : (
        <View style={[styles.image, styles.fallback, { backgroundColor: "#111111" }]}>
          <SymbolView
            name={{ ios: "play.circle.fill", android: "play_circle", web: "play_circle" }}
            size={28}
            tintColor="#FFFFFF"
          />
        </View>
      )}
      <View style={styles.badge}>
        <Text style={[styles.badgeLabel, { fontFamily: fontFamily.text }]}>Video</Text>
      </View>
      {uploading ? (
        <View style={styles.overlay}>
          <Text style={[styles.overlayLabel, { fontFamily: fontFamily.text }]}>
            {progress != null ? `Uploading ${progress}%` : "Uploading…"}
          </Text>
        </View>
      ) : null}
      {errored ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry video upload"
          onPress={onRetry}
          style={styles.overlay}
        >
          <Text style={[styles.overlayLabel, { fontFamily: fontFamily.text }]}>
            {video.errorMessage || "Couldn't add video"}
          </Text>
        </Pressable>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={uploading ? "Cancel video upload" : "Remove video"}
        onPress={onRemove}
        style={styles.remove}
      >
        <SymbolView
          name={{ ios: "xmark.circle.fill", android: "cancel", web: "cancel" }}
          size={20}
          tintColor="#FFFFFF"
        />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  tile: { width: 112, aspectRatio: 3 / 4, borderRadius: 10, overflow: "hidden" },
  empty: {
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  addLabel: { fontSize: 12, fontWeight: "600" },
  image: { width: "100%", height: "100%" },
  fallback: { alignItems: "center", justifyContent: "center" },
  badge: {
    position: "absolute",
    left: 6,
    bottom: 6,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeLabel: { color: "#FFFFFF", fontSize: 10, fontWeight: "700" },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
  },
  overlayLabel: { color: "#FFFFFF", fontSize: 11, fontWeight: "600", textAlign: "center" },
  remove: { position: "absolute", top: 6, right: 6 },
})
