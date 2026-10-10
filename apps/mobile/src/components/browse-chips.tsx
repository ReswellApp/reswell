import { SymbolView } from "expo-symbols"
import { useRef, useState } from "react"
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import {
  MOBILE_CATEGORY_CHIPS,
  type MobileBrowseRailItem,
  type MobileListingCategory,
} from "@reswell/api-contract"
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
          <ResourceMenu key={item.id} label={item.label} items={item.items} onOpenResource={onOpenResource} />
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

function ResourceMenu({
  label,
  items,
  onOpenResource,
}: {
  label: string
  items: { label: string; href: string; screen: string | null }[]
  onOpenResource: (screen: string) => void
}) {
  const colors = useReswellColors()
  const chipRef = useRef<View>(null)
  const [anchor, setAnchor] = useState<{ x: number; y: number; height: number } | null>(null)

  function open() {
    chipRef.current?.measureInWindow((x, y, _width, height) => {
      setAnchor({ x, y, height })
    })
  }

  return (
    <>
      <View ref={chipRef} collapsable={false}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={open}
          style={[styles.chip, styles.menuChip, { backgroundColor: colors.background, borderColor: colors.border }]}
        >
          <Text style={[styles.label, { color: colors.foreground, fontFamily: fontFamily.text }]}>{label}</Text>
          <SymbolView
            name={{ ios: "chevron.down", android: "expand_more", web: "expand_more" }}
            size={14}
            tintColor={colors.foreground}
          />
        </Pressable>
      </View>
      <Modal visible={anchor !== null} transparent animationType="fade" onRequestClose={() => setAnchor(null)}>
        <View style={styles.scrim}>
          <Pressable style={styles.scrim} onPress={() => setAnchor(null)} />
          <View
            style={[
              styles.menu,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                top: (anchor?.y ?? 0) + (anchor?.height ?? 0) + 6,
                left: Math.max(16, anchor?.x ?? 16),
              },
            ]}
          >
            {items.map((item) => (
              <Pressable
                key={item.href}
                accessibilityRole="button"
                onPress={() => {
                  setAnchor(null)
                  if (item.screen) onOpenResource(item.screen)
                }}
                style={styles.menuItem}
              >
                <Text style={[styles.menuLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
    </>
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
  menuChip: { flexDirection: "row", alignItems: "center", gap: 4 },
  label: { fontSize: 13, fontWeight: "600", lineHeight: 16 },
  scrim: { flex: 1 },
  menu: {
    position: "absolute",
    minWidth: 220,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingVertical: 6,
    shadowColor: "#000000",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  menuItem: { paddingHorizontal: 14, paddingVertical: 12 },
  menuLabel: { fontSize: 16, fontWeight: "500" },
})
