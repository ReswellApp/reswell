import { Pressable, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import type { MobileBoardType, MobileListingCategory } from "@reswell/api-contract"
import { BoardStyleFilter, CategorySlider } from "@/components/browse-chips"
import { Wordmark } from "@/components/wordmark"
import { fontFamily, useReswellColors } from "@/theme"

export function HomeHeader({
  signedIn,
  onAccount,
<<<<<<< Updated upstream
  onOpenCategory,
}: {
  signedIn: boolean
  onAccount: () => void
  onOpenCategory: (chip: MobileBrowseChip) => void
=======
  category,
  boardType,
  onSelectCategory,
  onSelectBoardType,
}: {
  signedIn: boolean
  onAccount: () => void
  category: MobileListingCategory | null
  boardType: MobileBoardType | null
  onSelectCategory: (next: MobileListingCategory | null) => void
  onSelectBoardType: (next: MobileBoardType | null) => void
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
      <BrowseChips onOpenCategory={onOpenCategory} />
=======
      <CategorySlider
        selected={category}
        onSelect={onSelectCategory}
        trailing={category === "surfboards"}
      />
      {category === "surfboards" ? (
        <BoardStyleFilter selected={boardType} onSelect={onSelectBoardType} />
      ) : null}
>>>>>>> Stashed changes
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
