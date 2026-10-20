import { SymbolView } from "expo-symbols"
import { useEffect, useRef } from "react"
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { fontFamily, useReswellColors } from "@/theme"

const ROW_HEIGHT = 52

export function SellOptionSheet({
  title,
  options,
  selected,
  focusValue,
  onSelect,
  onClose,
}: {
  title: string
  options: readonly { value: string; label: string }[]
  selected: string
  /** Value to center when nothing is selected yet (length / width / thickness). */
  focusValue?: string | null
  onSelect: (value: string) => void
  onClose: () => void
}) {
  const colors = useReswellColors()
  const insets = useSafeAreaInsets()
  const scrollRef = useRef<ScrollView>(null)
  const viewportHeight = useRef(0)
  const didCenter = useRef(false)

  const anchor = selected.trim() || focusValue?.trim() || ""
  const anchorIndex = anchor ? options.findIndex((option) => option.value === anchor) : -1

  function centerOnAnchor() {
    if (didCenter.current || anchorIndex < 0 || viewportHeight.current <= 0) return
    const contentY = anchorIndex * ROW_HEIGHT
    const offset = Math.max(0, contentY - viewportHeight.current / 2 + ROW_HEIGHT / 2)
    scrollRef.current?.scrollTo({ y: offset, animated: false })
    didCenter.current = true
  }

  useEffect(() => {
    didCenter.current = false
  }, [title, anchor])

  return (
    <Modal animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.foreground, fontFamily: fontFamily.headline }]}>{title}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.close}>
            <SymbolView name={{ ios: "xmark", android: "close", web: "close" }} size={18} tintColor={colors.foreground} />
          </Pressable>
        </View>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          onLayout={(event: LayoutChangeEvent) => {
            viewportHeight.current = event.nativeEvent.layout.height
            centerOnAnchor()
          }}
          onContentSizeChange={() => centerOnAnchor()}
        >
          {options.map((option) => {
            const active = option.value === selected
            return (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => onSelect(option.value)}
                style={[styles.row, { borderBottomColor: colors.border }]}
              >
                <Text style={[styles.rowLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                  {option.label}
                </Text>
                {active ? (
                  <SymbolView
                    name={{ ios: "checkmark", android: "check", web: "check" }}
                    size={18}
                    tintColor={colors.foreground}
                    weight="semibold"
                  />
                ) : null}
              </Pressable>
            )
          })}
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
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 20, fontWeight: "600" },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  row: {
    minHeight: ROW_HEIGHT,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: { fontSize: 16 },
})
