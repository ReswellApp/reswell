import { SymbolView } from "expo-symbols"
import { useRouter } from "expo-router"
import { ReswellInboxIcon } from "@/components/reswell-icons"
import { useEffect, useRef, useState } from "react"
import {
  Animated,
  Easing,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { SearchOverlayBody } from "@/components/search-screen"
import { useCartCount } from "@/lib/cart-count"
import { useInboxUnreadCount } from "@/lib/inbox-unread-count"
import { rememberSearch } from "@/lib/recent-searches"
import { fontFamily, useReswellColors } from "@/theme"

const PLACEHOLDER = "Search surfboards, fins, wetsuits or apparel…"

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

const SEARCH_OPEN_MS = 340
const SEARCH_CLOSE_MS = 300
const SEARCH_EASING_OPEN = Easing.bezier(0.22, 1, 0.36, 1)
const SEARCH_EASING_CLOSE = Easing.bezier(0.4, 0, 0.2, 1)

function runSearchBarLayoutAnimation() {
  LayoutAnimation.configureNext({
    duration: SEARCH_OPEN_MS,
    create: {
      type: LayoutAnimation.Types.easeInEaseOut,
      property: LayoutAnimation.Properties.opacity,
    },
    update: { type: LayoutAnimation.Types.easeInEaseOut },
    delete: {
      type: LayoutAnimation.Types.easeInEaseOut,
      property: LayoutAnimation.Properties.opacity,
    },
  })
}

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
  const inboxUnread = useInboxUnreadCount()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const insetTop = props.insetTop !== false
  const bordered = props.bordered !== false
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [overlayTop, setOverlayTop] = useState(0)
  const [barWindowY, setBarWindowY] = useState(0)
  const barRef = useRef<View>(null)
  const inputRef = useRef<TextInput>(null)
  const overlayProgress = useRef(new Animated.Value(0)).current
  const closing = useRef(false)

  const underlayOpacity = overlayProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  })
  const chromeOpacity = overlayProgress
  const panelOpacity = overlayProgress.interpolate({
    inputRange: [0, 0.25, 1],
    outputRange: [0, 0.35, 1],
  })
  const panelTranslateY = overlayProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 0],
  })
  const queryHasText = query.length > 0

  function animateSearchOpen() {
    runSearchBarLayoutAnimation()
    overlayProgress.stopAnimation()
    overlayProgress.setValue(0)
    setOpen(true)
    Animated.timing(overlayProgress, {
      toValue: 1,
      duration: SEARCH_OPEN_MS,
      easing: SEARCH_EASING_OPEN,
      useNativeDriver: true,
    }).start()
    setTimeout(() => inputRef.current?.focus(), 120)
  }

  useEffect(() => {
    if (!open) {
      overlayProgress.setValue(0)
      return
    }
    measureOverlayTop()
  }, [open, overlayProgress])

  useEffect(() => {
    if (!open) return
    runSearchBarLayoutAnimation()
  }, [open, queryHasText])

  function measureOverlayTop() {
    barRef.current?.measureInWindow((_x, y, _w, h) => {
      setBarWindowY(y)
      setOverlayTop(y + h)
    })
  }

  function closeSearch(after?: () => void) {
    if (!open || closing.current) {
      after?.()
      return
    }
    closing.current = true
    runSearchBarLayoutAnimation()
    overlayProgress.stopAnimation()
    Animated.timing(overlayProgress, {
      toValue: 0,
      duration: SEARCH_CLOSE_MS,
      easing: SEARCH_EASING_CLOSE,
      useNativeDriver: true,
    }).start(() => {
      closing.current = false
      setOpen(false)
      setQuery("")
      overlayProgress.setValue(0)
      after?.()
    })
  }

  function openSearch() {
    if (props.mode !== "open") return
    barRef.current?.measureInWindow((_x, y, _w, h) => {
      setBarWindowY(y)
      setOverlayTop(y + h)
      animateSearchOpen()
    })
  }

  function runSearch() {
    if (props.mode !== "open") return
    const trimmed = query.trim()
    if (trimmed.length < 2) return
    rememberSearch(trimmed).catch(() => undefined)
    closeSearch(() => router.push({ pathname: "/search-results", params: { q: trimmed } }))
  }

  function renderBarChrome(mode: "idle" | "active" | "input") {
    return (
    <>
      {props.onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
          onPress={mode === "active" ? () => closeSearch() : props.onBack}
        >
          <SymbolView name={{ ios: "chevron.left", android: "arrow_back", web: "arrow_back" }} size={22} tintColor={colors.foreground} />
        </Pressable>
      ) : mode === "active" ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} onPress={() => closeSearch()}>
          <SymbolView name={{ ios: "chevron.left", android: "arrow_back", web: "arrow_back" }} size={22} tintColor={colors.foreground} />
        </Pressable>
      ) : null}
      {mode === "input" ? (
        <View style={[styles.field, { borderColor: colors.border }]}>
          <TextInput
            value={props.mode === "input" ? props.value : ""}
            onChangeText={props.mode === "input" ? props.onChangeText : () => undefined}
            placeholder={PLACEHOLDER}
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={props.mode === "input" ? props.onSubmit : undefined}
            style={[styles.input, { color: colors.foreground, fontFamily: fontFamily.text }]}
          />
          <SearchMark onPress={props.mode === "input" ? props.onSubmit : () => undefined} />
        </View>
      ) : mode === "active" ? (
        <View style={[styles.field, { borderColor: colors.border }]}>
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder={PLACEHOLDER}
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={runSearch}
            style={[styles.input, { color: colors.foreground, fontFamily: fontFamily.text, paddingRight: 8 }]}
          />
          {query.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={4}
              onPress={() => setQuery("")}
              style={styles.clearButton}
            >
              <SymbolView name={{ ios: "xmark.circle.fill", android: "cancel", web: "cancel" }} size={22} tintColor={colors.muted} />
            </Pressable>
          ) : (
            <SearchMark onPress={runSearch} />
          )}
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
      {mode !== "active" && props.onInbox ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={inboxUnread > 0 ? `Inbox, ${inboxUnread} unread` : "Inbox"}
          hitSlop={6}
          onPress={props.onInbox}
          style={styles.iconButton}
        >
          <ReswellInboxIcon />
          {inboxUnread > 0 ? (
            <View style={[styles.inboxTicker, { backgroundColor: colors.destructive }]}>
              <Text style={[styles.tickerLabel, { color: "#FFFFFF", fontFamily: fontFamily.text }]}>
                {inboxUnread > 9 ? "9+" : inboxUnread}
              </Text>
            </View>
          ) : null}
        </Pressable>
      ) : null}
      {mode !== "active" ? (
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
      ) : null}
    </>
    )
  }

  const pageBarMode = props.mode === "input" ? "input" : "idle"
  const searchOverlayOpen = open && props.mode === "open"
  const barStyle = [
    styles.bar,
    insetTop ? { paddingTop: insets.top } : null,
    bordered ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border } : null,
    { backgroundColor: colors.background },
  ]

  return (
    <>
      <Animated.View
        ref={barRef}
        onLayout={() => {
          if (open) measureOverlayTop()
        }}
        style={[barStyle, searchOverlayOpen ? { opacity: underlayOpacity } : null]}
        pointerEvents={searchOverlayOpen ? "none" : "auto"}
      >
        {renderBarChrome(searchOverlayOpen ? "idle" : pageBarMode)}
      </Animated.View>
      {props.mode === "open" ? (
        <Modal visible={open} transparent animationType="none" statusBarTranslucent onRequestClose={() => closeSearch()}>
          <View style={styles.modalRoot} pointerEvents="box-none">
            <Animated.View
              style={[barStyle, styles.modalBar, { top: barWindowY, opacity: chromeOpacity }]}
              pointerEvents="auto"
            >
              {renderBarChrome("active")}
            </Animated.View>
            <Pressable
              style={[styles.modalDismiss, { top: overlayTop }]}
              onPress={() => closeSearch()}
            >
              <Animated.View
                style={[
                  styles.overlayBody,
                  {
                    backgroundColor: colors.background,
                    opacity: panelOpacity,
                    transform: [{ translateY: panelTranslateY }],
                  },
                ]}
              >
                <Pressable style={styles.overlayBodyInner} onPress={(event) => event.stopPropagation()}>
                  <SearchOverlayBody query={query} onChangeQuery={setQuery} onClose={closeSearch} />
                </Pressable>
              </Animated.View>
            </Pressable>
          </View>
        </Modal>
      ) : null}
    </>
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
  modalRoot: {
    flex: 1,
  },
  modalBar: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 2,
  },
  modalDismiss: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  overlayBody: {
    flex: 1,
  },
  overlayBodyInner: {
    flex: 1,
  },
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
  clearButton: {
    width: 34,
    height: 34,
    marginRight: -2,
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
  inboxTicker: {
    position: "absolute",
    top: -5,
    right: -7,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  tickerLabel: { fontSize: 10, fontWeight: "700", lineHeight: 12 },
})
