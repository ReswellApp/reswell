import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { SymbolView } from "expo-symbols"
import { fontFamily, useReswellColors } from "@/theme"

const TIPS = [
  {
    title: "Measure the outer box",
    body: "Use the outside of the packed bag or carton — not the bare board. Carriers bill the package you hand them.",
  },
  {
    title: "Length, width, and height",
    body: "Length is the longest side. Width and height are the other two sides. Enter all three in inches.",
  },
  {
    title: "Round up",
    body: "Round weight and measurements up to the nearest ounce and inch so checkout rates match what you ship.",
  },
  {
    title: "Include packing weight",
    body: "Weigh the fully packed board (box, padding, and board), not the item alone.",
  },
] as const

export function SellMeasurementTipsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useReswellColors()
  const insets = useSafeAreaInsets()

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.foreground, fontFamily: fontFamily.headline }]}>Measurement tips</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={8}>
            <SymbolView name={{ ios: "xmark", android: "close", web: "close" }} size={18} tintColor={colors.foreground} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
          <Text style={[styles.lead, { color: colors.muted, fontFamily: fontFamily.text }]}>
            Accurate box size and weight keep checkout rates honest and help avoid carrier adjustments after the sale.
          </Text>
          {TIPS.map((tip) => (
            <View key={tip.title} style={[styles.tip, { borderColor: colors.border, backgroundColor: colors.image }]}>
              <Text style={[styles.tipTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>{tip.title}</Text>
              <Text style={[styles.tipBody, { color: colors.muted, fontFamily: fontFamily.text }]}>{tip.body}</Text>
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
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 18, fontWeight: "700" },
  body: { padding: 16, gap: 12 },
  lead: { fontSize: 15, lineHeight: 22 },
  tip: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 6 },
  tipTitle: { fontSize: 15, fontWeight: "700" },
  tipBody: { fontSize: 15, lineHeight: 22 },
})
