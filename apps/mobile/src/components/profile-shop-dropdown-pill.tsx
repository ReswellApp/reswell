import { SymbolView } from "expo-symbols"
import { useState } from "react"
import { Modal, Pressable, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { bottomSheetListPaddingBottom } from "@/components/screen-shell"
import { fontFamily, useReswellColors } from "@/theme"

export type ProfileShopDropdownOption = {
  id: string | null
  label: string
}

export function ProfileShopDropdownPill({
  label,
  accessibilityLabel,
  emphasized,
  options,
  value,
  onChange,
}: {
  label: string
  accessibilityLabel: string
  emphasized?: boolean
  options: ProfileShopDropdownOption[]
  value: string | null
  onChange: (id: string | null) => void
}) {
  const colors = useReswellColors()
  const insets = useSafeAreaInsets()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(true)}
        style={[
          styles.pill,
          {
            borderColor: emphasized ? colors.foreground : colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        <Text style={[styles.pillLabel, { color: colors.foreground, fontFamily: fontFamily.text }]} numberOfLines={1}>
          {label}
        </Text>
        <SymbolView name={{ ios: "chevron.down", android: "expand_more", web: "expand_more" }} size={14} tintColor={colors.muted} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setOpen(false)}>
          <View
            style={[
              styles.sheet,
              { backgroundColor: colors.background, paddingBottom: bottomSheetListPaddingBottom(insets.bottom) },
            ]}
          >
            {options.map((option) => {
              const selected = option.id === value
              return (
                <Pressable
                  key={option.id ?? "all"}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    onChange(option.id)
                    setOpen(false)
                  }}
                  style={styles.sheetRow}
                >
                  <Text
                    style={{
                      color: selected ? colors.foreground : colors.muted,
                      fontFamily: fontFamily.text,
                      fontWeight: selected ? "700" : "600",
                      fontSize: 16,
                    }}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    minHeight: 40,
    maxWidth: "100%",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
  },
  pillLabel: { fontSize: 14, fontWeight: "600", flexShrink: 1 },
  scrim: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.28)" },
  sheet: { borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingTop: 8 },
  sheetRow: { paddingHorizontal: 20, paddingVertical: 16 },
})
