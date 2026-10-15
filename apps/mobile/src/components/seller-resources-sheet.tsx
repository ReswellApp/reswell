import { useEffect, useRef, useState } from "react"
import { Animated, Modal, Pressable, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { fontFamily, useReswellColors } from "@/theme"

const SHEET_OFFSET = 480

/** Seller Resources opens as a bottom sheet. Links still come from the website rail. */
export function SellerResourcesSheet({
  label,
  items,
  onOpenResource,
}: {
  label: string
  items: { label: string; href: string; screen: string | null }[]
  onOpenResource: (screen: string) => void
}) {
  const colors = useReswellColors()
  const insets = useSafeAreaInsets()
  const [open, setOpen] = useState(false)
  const closing = useRef(false)
  const translateY = useRef(new Animated.Value(SHEET_OFFSET)).current
  const backdrop = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!open) return
    translateY.setValue(SHEET_OFFSET)
    backdrop.setValue(0)
    Animated.parallel([
      Animated.timing(backdrop, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start()
  }, [backdrop, open, translateY])

  function close(after?: () => void) {
    if (closing.current) return
    closing.current = true
    Animated.parallel([
      Animated.timing(backdrop, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: SHEET_OFFSET, duration: 220, useNativeDriver: true }),
    ]).start(() => {
      closing.current = false
      setOpen(false)
      after?.()
    })
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => setOpen(true)}
        style={[styles.chip, { backgroundColor: colors.background, borderColor: colors.border }]}
      >
        <Text style={[styles.label, { color: colors.foreground, fontFamily: fontFamily.text }]}>{label}</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="none" statusBarTranslucent onRequestClose={() => close()}>
        <View style={styles.overlay}>
          <Animated.View style={[styles.scrim, { opacity: backdrop }]}>
            <Pressable accessibilityLabel="Dismiss" style={StyleSheet.absoluteFill} onPress={() => close()} />
          </Animated.View>
          <Animated.View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.background,
                paddingBottom: Math.max(insets.bottom, 20),
                transform: [{ translateY }],
              },
            ]}
          >
            <View style={styles.handle} />
            <Text style={[styles.title, { color: colors.foreground, fontFamily: fontFamily.headline }]}>{label}</Text>
            {items.map((item) => (
              <Pressable
                key={item.href}
                accessibilityRole="button"
                onPress={() =>
                  close(() => {
                    if (item.screen) onOpenResource(item.screen)
                  })
                }
                style={styles.item}
              >
                <Text style={[styles.itemLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </Animated.View>
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 36,
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  label: { fontSize: 13, fontWeight: "600", lineHeight: 16 },
  overlay: { flex: 1, justifyContent: "flex-end" },
  scrim: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    overflow: "hidden",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 8,
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 5,
    borderRadius: 3,
    marginBottom: 16,
    backgroundColor: "#C8C8C8",
  },
  title: { fontSize: 20, fontWeight: "700", textAlign: "center", marginBottom: 8 },
  item: { paddingHorizontal: 24, paddingVertical: 18 },
  itemLabel: { fontSize: 17, lineHeight: 22 },
})
