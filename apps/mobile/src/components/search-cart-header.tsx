import { SymbolView } from "expo-symbols"
import { useEffect, useRef, useState } from "react"
import { Animated, Modal, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { SearchScreen } from "@/components/search-screen"
import { useCartCount } from "@/lib/cart-count"
import { fontFamily, useReswellColors } from "@/theme"

const PLACEHOLDER = "Search surfboards, fins, wetsuits or apparel…"

type SearchCartHeaderProps = {
  onBack?: () => void
  onCart: () => void
  onInbox?: () => void
  /** Homepage sits this row under the wordmark, which already handles the status bar and border. */
  insetTop?: boolean
  bordered?: boolean
} & (
  | { mode: "open" }
  | {
      mode: "input"
      value: string
      onChangeText: (value: string) => void
      onSubmit: () => void
    }
)

/** Search field and cart on one row. Same bar on category pages and search results. */
export function SearchCartHeader(props: SearchCartHeaderProps) {
  const colors = useReswellColors()
  const cartCount = useCartCount()
  const insets = useSafeAreaInsets()
  const insetTop = props.insetTop !== false
  const bordered = props.bordered !== false
  const { height } = useWindowDimensions()
  const [open, setOpen] = useState(false)
  const [openId, setOpenId] = useState(0)
  const [settled, setSettled] = useState(false)
  const closing = useRef(false)
  const heightRef = useRef(height)
  const motion = useRef<Animated.CompositeAnimation | null>(null)
  const translateY = useRef(new Animated.Value(-height)).current
  heightRef.current = height

  useEffect(() => {
    if (!open) return
    setSettled(false)
    translateY.setValue(-heightRef.current)
    const animation = Animated.timing(translateY, { toValue: 0, duration: 280, useNativeDriver: true })
    motion.current = animation
    animation.start(({ finished }) => {
      if (finished) setSettled(true)
    })
    return () => animation.stop()
  }, [open, translateY])

  function closeSearch(after?: () => void) {
    if (!open || closing.current) return
    closing.current = true
    motion.current?.stop()
    setSettled(false)
    requestAnimationFrame(() => {
      const animation = Animated.timing(translateY, { toValue: -heightRef.current, duration: 220, useNativeDriver: true })
      motion.current = animation
      animation.start(() => {
        closing.current = false
        setOpen(false)
        after?.()
      })
    })
  }

  function openSearch() {
    setOpenId((id) => id + 1)
    setOpen(true)
  }

  return (
    <View
      style={[
        styles.bar,
        insetTop ? { paddingTop: insets.top } : null,
        bordered ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border } : null,
        { backgroundColor: colors.background },
      ]}
    >
      {props.onBack ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} onPress={props.onBack}>
          <SymbolView name={{ ios: "chevron.left", android: "arrow_back", web: "arrow_back" }} size={22} tintColor={colors.foreground} />
        </Pressable>
      ) : null}
      {props.mode === "input" ? (
        <View style={[styles.field, { borderColor: colors.border }]}>
          <TextInput
            value={props.value}
            onChangeText={props.onChangeText}
            placeholder={PLACEHOLDER}
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={props.onSubmit}
            style={[styles.input, { color: colors.foreground, fontFamily: fontFamily.text }]}
          />
          <SearchMark onPress={props.onSubmit} />
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search"
          onPress={openSearch}
          style={[styles.field, { borderColor: colors.border }]}
        >
          <Text numberOfLines={1} style={[styles.placeholder, { color: colors.muted, fontFamily: fontFamily.text }]}>
            {PLACEHOLDER}
          </Text>
          <SearchMark onPress={openSearch} />
        </Pressable>
      )}
      {props.onInbox ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Inbox"
          hitSlop={6}
          onPress={props.onInbox}
          style={styles.iconButton}
        >
          <SymbolView name={{ ios: "bell", android: "notifications", web: "notifications" }} size={22} tintColor={colors.foreground} />
        </Pressable>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={cartCount > 0 ? `Cart, ${cartCount} items` : "Cart"}
        hitSlop={6}
        onPress={props.onCart}
        style={styles.iconButton}
      >
        <SymbolView name={{ ios: "cart", android: "shopping_cart", web: "shopping_cart" }} size={22} tintColor={colors.foreground} />
        {cartCount > 0 ? (
          <View style={[styles.ticker, { backgroundColor: colors.foreground }]}>
            <Text style={[styles.tickerLabel, { color: colors.primaryForeground, fontFamily: fontFamily.text }]}>
              {cartCount > 9 ? "9+" : cartCount}
            </Text>
          </View>
        ) : null}
      </Pressable>
      {props.mode === "open" ? (
        <Modal visible={open} transparent animationType="none" statusBarTranslucent onRequestClose={() => closeSearch()}>
          <Animated.View
            style={[
              styles.cover,
              { backgroundColor: colors.background },
              settled ? null : { transform: [{ translateY }] },
            ]}
          >
            <SearchScreen key={openId} onClose={closeSearch} />
          </Animated.View>
        </Modal>
      ) : null}
    </View>
  )
}

function SearchMark({ onPress }: { onPress: () => void }) {
  const colors = useReswellColors()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Search"
      onPress={onPress}
      style={[styles.searchButton, { backgroundColor: colors.primary }]}
    >
      <SymbolView
        name={{ ios: "magnifyingglass", android: "search", web: "search" }}
        size={16}
        tintColor={colors.primaryForeground}
        weight="semibold"
      />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  cover: { flex: 1 },
  field: {
    flex: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 999,
    paddingLeft: 14,
    paddingRight: 4,
  },
  placeholder: { flex: 1, fontSize: 16, paddingVertical: 8, paddingRight: 8 },
  input: { flex: 1, fontSize: 16, paddingVertical: 8 },
  searchButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  iconButton: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  ticker: {
    position: "absolute",
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  tickerLabel: { fontSize: 10, fontWeight: "700", lineHeight: 12 },
})
