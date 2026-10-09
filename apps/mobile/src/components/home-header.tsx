import { Pressable, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import type { MobileBrowseChip } from "@reswell/api-contract"
import { BrowseChips } from "@/components/browse-chips"
import { Wordmark } from "@/components/wordmark"
import { fontFamily, useReswellColors } from "@/theme"

export function HomeHeader({
  signedIn,
  onAccount,
  onOpenCategory,
}: {
  signedIn: boolean
  onAccount: () => void
  onOpenCategory: (chip: MobileBrowseChip) => void
}) {
  const colors = useReswellColors()
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.bar, { paddingTop: insets.top, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
      <View style={styles.titleRow}>
        <Wordmark />
        <Pressable onPress={onAccount} hitSlop={8}>
          <Text style={[styles.account, { color: colors.foreground, fontFamily: fontFamily.text }]}>
            {signedIn ? "Account" : "Sign in"}
          </Text>
        </Pressable>
      </View>
      <BrowseChips onOpenCategory={onOpenCategory} />
    </View>
  )
}

const styles = StyleSheet.create({
  bar: { borderBottomWidth: StyleSheet.hairlineWidth },
  titleRow: {
    minHeight: 44,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  account: { fontSize: 16, fontWeight: "600" },
})
