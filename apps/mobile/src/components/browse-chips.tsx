import { Pressable, ScrollView, StyleSheet, Text } from "react-native"
import {
  MOBILE_CATEGORY_CHIPS,
  type MobileBrowseRailItem,
  type MobileListingCategory,
} from "@reswell/api-contract"
import { SellerResourcesSheet } from "@/components/seller-resources-sheet"
import { fontFamily, useReswellColors } from "@/theme"

const FALLBACK_ITEMS: MobileBrowseRailItem[] = MOBILE_CATEGORY_CHIPS.map((chip) => ({
  kind: "category",
  label: chip.label,
  href: "",
  category: chip.category,
}))

/** Homepage slider. Categories and Seller Resources both open native screens. */
export function CategorySlider({
  items,
  onOpenCategory,
  onOpenResource,
}: {
  items: MobileBrowseRailItem[] | null
  onOpenCategory: (category: MobileListingCategory) => void
  onOpenResource: (screen: string) => void
}) {
  const colors = useReswellColors()
  const rail = items && items.length > 0 ? items : FALLBACK_ITEMS

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroller}
      contentContainerStyle={styles.categoryRow}
    >
      {rail.map((item) =>
        item.kind === "menu" ? (
          <SellerResourcesSheet key={item.id} label={item.label} items={item.items} onOpenResource={onOpenResource} />
        ) : (
          <Pressable
            key={item.href || item.category || item.label}
            accessibilityRole="button"
            onPress={() => {
              if (item.category) onOpenCategory(item.category)
            }}
            style={[styles.chip, { backgroundColor: colors.background, borderColor: colors.border }]}
          >
            <Text style={[styles.label, { color: colors.foreground, fontFamily: fontFamily.text }]}>{item.label}</Text>
          </Pressable>
        ),
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroller: { flexGrow: 0 },
  categoryRow: {
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  chip: {
    minHeight: 36,
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  label: { fontSize: 13, fontWeight: "600", lineHeight: 16 },
})
