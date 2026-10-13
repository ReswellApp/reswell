import { SymbolView } from "expo-symbols"
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { fontFamily, useReswellColors } from "@/theme"

const TIPS = [
  {
    title: "Photograph every side",
    body: "Deck, bottom, rails, nose, and tail. A listing with one photo gets skipped, or the buyer has to ask for more before they will commit.",
  },
  {
    title: "Use one background",
    body: "A plain wall or sheet keeps the board as the subject. The same background across your listings is enough.",
  },
  {
    title: "Keep the light even",
    body: "Daylight by a window is enough. Harsh shadows across the deck hide color and contours.",
  },
  {
    title: "A phone is enough",
    body: "A steady phone photo in good light sells as well as a camera shot. Crop it square before you upload.",
  },
  {
    title: "Show the dings",
    body: "Photograph every imperfection up close, and name it in the description so the buyer is not surprised.",
  },
] as const

export function SellPhotoTips({ onClose }: { onClose: () => void }) {
  const colors = useReswellColors()
  const insets = useSafeAreaInsets()

  return (
    <Modal animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
            Tips for top-notch photos
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.close}>
            <SymbolView name={{ ios: "xmark", android: "close", web: "close" }} size={18} tintColor={colors.foreground} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
          {TIPS.map((tip, index) => (
            <View key={tip.title} style={styles.tip}>
              <Text style={[styles.tipTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
                Tip #{index + 1}: {tip.title}
              </Text>
              <Text style={[styles.tipBody, { color: colors.foreground, fontFamily: fontFamily.text }]}>{tip.body}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    minHeight: 56,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { flex: 1, fontSize: 20, fontWeight: "600" },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  body: { padding: 16, gap: 22 },
  tip: { gap: 6 },
  tipTitle: { fontSize: 18, fontWeight: "600" },
  tipBody: { fontSize: 16, lineHeight: 22 },
})
