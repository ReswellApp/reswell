import { SymbolView, type AndroidSymbol, type SFSymbol } from "expo-symbols"
import { Modal, Pressable, StyleSheet, Text, View } from "react-native"
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
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable accessibilityRole="button" onPress={onClose} style={styles.backdrop}>
        <View style={[styles.menu, { backgroundColor: colors.background }]}>
          <MenuRow icon={{ ios: "photo.on.rectangle", android: "photo_library" }} label="Photo Library" onPress={onLibrary} />
          <MenuRow icon={{ ios: "camera", android: "photo_camera" }} label="Take Photo" onPress={onCamera} />
        </View>
      </Pressable>
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
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.row}>
      <SymbolView name={{ ios: icon.ios, android: icon.android, web: icon.android }} size={22} tintColor={colors.foreground} />
      <Text style={[styles.label, { color: colors.foreground, fontFamily: fontFamily.text }]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.25)", justifyContent: "center", padding: 28 },
  menu: { borderRadius: 16, paddingVertical: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, minHeight: 52 },
  label: { fontSize: 17 },
})
