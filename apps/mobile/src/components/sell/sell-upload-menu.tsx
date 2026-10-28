import { SymbolView, type AndroidSymbol, type SFSymbol } from "expo-symbols"
import { Modal, Pressable, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { fontFamily, useReswellColors } from "@/theme"

export function SellUploadMenu({
  onLibrary,
  onCamera,
  onClose,
}: {
  onLibrary: () => void
  onCamera: () => void
  onClose: () => void
}) {
  const colors = useReswellColors()
  const insets = useSafeAreaInsets()

  return (
    <Modal
      transparent
      animationType="slide"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.screen}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          style={styles.backdrop}
        />
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.background, paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <Text style={[styles.title, { color: colors.foreground, fontFamily: fontFamily.headline }]}>Add a photo</Text>
          <MenuRow icon={{ ios: "photo.on.rectangle", android: "photo_library" }} label="Photo Library" onPress={onLibrary} />
          <MenuRow icon={{ ios: "camera", android: "photo_camera" }} label="Take Photo" onPress={onCamera} />
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.cancel}>
            <Text style={[styles.cancelLabel, { color: colors.muted, fontFamily: fontFamily.text }]}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

function MenuRow({
  icon,
  label,
  onPress,
}: {
  icon: { ios: SFSymbol; android: AndroidSymbol }
  label: string
  onPress: () => void
}) {
  const colors = useReswellColors()
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.row, { borderColor: colors.border, backgroundColor: colors.image }]}
    >
      <SymbolView name={{ ios: icon.ios, android: icon.android, web: icon.android }} size={22} tintColor={colors.foreground} />
      <Text style={[styles.label, { color: colors.foreground, fontFamily: fontFamily.text }]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: "flex-end" },
  /** Flex dim above the sheet — not absoluteFill, so the sheet never sits under the scrim. */
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 10,
    zIndex: 1,
  },
  handle: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, marginBottom: 6 },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 4 },
  row: {
    minHeight: 56,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  label: { fontSize: 17, fontWeight: "600" },
  cancel: { minHeight: 48, alignItems: "center", justifyContent: "center" },
  cancelLabel: { fontSize: 16, fontWeight: "600" },
})
