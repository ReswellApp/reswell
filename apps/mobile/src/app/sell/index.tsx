import { Stack, useRouter } from "expo-router"
import { ScrollView, StyleSheet, Text } from "react-native"
import { AccountRow } from "@/components/account-row"
import { SELL_SECTIONS } from "@/lib/sell-flow"
import { fontFamily, useReswellColors } from "@/theme"

export default function SellHubScreen() {
  const colors = useReswellColors()
  const router = useRouter()

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.list}>
      <Stack.Screen options={{ title: "Sell" }} />
      <Text style={[styles.intro, { color: colors.muted, fontFamily: fontFamily.text }]}>Choose a product type.</Text>
      {SELL_SECTIONS.map((section) => (
        <AccountRow
          key={section.slug}
          title={section.title}
          onPress={() => router.push({ pathname: "/sell/[section]", params: { section: section.slug } })}
        />
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  list: { paddingBottom: 120 },
  intro: { fontSize: 15, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
})
