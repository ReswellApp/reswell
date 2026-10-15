import { SymbolView, type AndroidSymbol } from "expo-symbols"
import { useEffect, useRef, useState } from "react"
import { Animated, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import type { SFSymbol } from "sf-symbols-typescript"
import { SearchScreen } from "@/components/search-screen"
import { Wordmark } from "@/components/wordmark"
import { fontFamily, useReswellColors } from "@/theme"

type HeaderIcon = { ios: SFSymbol; android: AndroidSymbol }

export function HomeHeader({
  onNotifications,
  onCart,
}: {
  onNotifications: () => void
  onCart: () => void
}) {
  const colors = useReswellColors()
  const insets = useSafeAreaInsets()
  const { height } = useWindowDimensions()
  const [open, setOpen] = useState(false)
  const [openId, setOpenId] = useState(0)
  const closing = useRef(false)
  const translateY = useRef(new Animated.Value(-height)).current

  useEffect(() => {
    if (!open) return
    translateY.setValue(-height)
    Animated.timing(translateY, { toValue: 0, duration: 280, useNativeDriver: true }).start()
  }, [height, open, translateY])

  function close(after?: () => void) {
    if (!open || closing.current) return
    closing.current = true
    Animated.timing(translateY, { toValue: -height, duration: 220, useNativeDriver: true }).start(() => {
      closing.current = false
      setOpen(false)
      after?.()
    })
  }

  return (
    <View style={[styles.bar, { paddingTop: insets.top, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
      <View style={styles.logoRow}>
        <View style={styles.logoSide} />
        <Wordmark />
        <HeaderIconButton icon={{ ios: "cart", android: "shopping_cart" }} label="Cart" onPress={onCart} />
      </View>
      <View style={styles.searchRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search"
          onPress={() => {
            setOpenId((id) => id + 1)
            setOpen(true)
          }}
          style={[styles.pill, { borderColor: colors.border, backgroundColor: colors.background }]}
        >
          <Text numberOfLines={1} style={[styles.placeholder, { color: colors.muted, fontFamily: fontFamily.text }]}>
            Search surfboards, fins, wetsuits or apparel…
          </Text>
          <View style={[styles.searchButton, { backgroundColor: colors.primary }]}>
            <SymbolView
              name={{ ios: "magnifyingglass", android: "search", web: "search" }}
              size={16}
              tintColor={colors.primaryForeground}
              weight="semibold"
            />
          </View>
        </Pressable>
        <HeaderIconButton icon={{ ios: "bell", android: "notifications" }} label="Notifications" onPress={onNotifications} />
      </View>
      <Modal visible={open} transparent animationType="none" statusBarTranslucent onRequestClose={() => close()}>
        <Animated.View style={[styles.cover, { backgroundColor: colors.background, transform: [{ translateY }] }]}>
          <SearchScreen key={openId} onClose={close} />
        </Animated.View>
      </Modal>
    </View>
  )
}

function HeaderIconButton({
  icon,
  label,
  onPress,
}: {
  icon: HeaderIcon
  label: string
  onPress: () => void
}) {
  const colors = useReswellColors()
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={6} onPress={onPress} style={styles.iconButton}>
      <SymbolView
        name={{ ios: icon.ios, android: icon.android, web: icon.android }}
        size={22}
        tintColor={colors.foreground}
        weight="regular"
      />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  bar: { borderBottomWidth: StyleSheet.hairlineWidth },
  cover: { flex: 1 },
  logoRow: {
    minHeight: 44,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logoSide: { width: 32 },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  pill: {
    flex: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 999,
    paddingLeft: 14,
    paddingRight: 4,
  },
  placeholder: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 8,
    paddingRight: 8,
  },
  searchButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  iconButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
})
