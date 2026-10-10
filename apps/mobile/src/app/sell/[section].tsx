import { Stack, useLocalSearchParams, useRouter } from "expo-router"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { SellListingFlow } from "@/components/sell/sell-listing-flow"
import { sellSectionBySlug } from "@/lib/sell-flow"
import { fontFamily, useReswellColors } from "@/theme"

export default function SellSectionScreen() {
  const params = useLocalSearchParams<{ section?: string }>()
  const section = sellSectionBySlug(typeof params.section === "string" ? params.section : undefined)
  const colors = useReswellColors()
  const router = useRouter()

  if (!section) {
    return (
      <View style={[styles.missing, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: "Sell" }} />
        <Text style={[styles.copy, { color: colors.foreground, fontFamily: fontFamily.text }]}>
          That product type isn’t available.
        </Text>
        <Pressable accessibilityRole="button" onPress={() => router.replace("/sell")}>
          <Text style={[styles.link, { color: colors.foreground, fontFamily: fontFamily.text }]}>Back to sell</Text>
        </Pressable>
      </View>
    )
  }

  return <SellListingFlow section={section} />
}

const styles = StyleSheet.create({
  missing: { flex: 1, padding: 24, gap: 16 },
  copy: { fontSize: 16 },
  link: { fontSize: 16, fontWeight: "600" },
})
