import { SymbolView, type AndroidSymbol } from "expo-symbols"
import { usePathname, useRouter } from "expo-router"
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { Platform, Pressable, StyleSheet, Text, useColorScheme, View, type ViewStyle } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import type { SFSymbol } from "sf-symbols-typescript"
import { useAuth } from "@/lib/auth-context"
import { useAuthGate } from "@/lib/auth-gate"
import { fontFamily, useReswellColors } from "@/theme"

/** Used until the bar reports its laid-out height. Icon, label, and vertical padding. */
const TAB_BAR_FALLBACK_HEIGHT = 58
/** Space between scroll content and the top of the bar. */
const TAB_BAR_CONTENT_GAP = 12

type StackRoute = { name: string }
type StackNavigationState = { index: number; routes: StackRoute[] }
type StackNavigationForTabBar = { getState(): StackNavigationState | undefined }

const TabBarHeightContext = createContext<{
  height: number
  setHeight: (height: number) => void
} | null>(null)

/** Pathname updates after stack transitions; override only for the in-flight animation. */
type TabBarTransitionOverride = "show" | "hide" | null

const TabBarTransitionContext = createContext<{
  transitionOverride: TabBarTransitionOverride
  setTransitionOverride: (next: TabBarTransitionOverride) => void
} | null>(null)

export function FloatingTabBarInsetProvider({ children }: { children: ReactNode }) {
  const [height, setBarHeight] = useState(0)
  const [transitionOverride, setTransitionOverride] = useState<TabBarTransitionOverride>(null)
  const setHeight = useCallback((next: number) => {
    setBarHeight((current) => (current === next ? current : next))
  }, [])
  const heightValue = useMemo(() => ({ height, setHeight }), [height, setHeight])
  const transitionValue = useMemo(
    () => ({ transitionOverride, setTransitionOverride }),
    [transitionOverride],
  )
  return (
    <TabBarTransitionContext.Provider value={transitionValue}>
      <TabBarHeightContext.Provider value={heightValue}>{children}</TabBarHeightContext.Provider>
    </TabBarTransitionContext.Provider>
  )
}

/** Pass to root `<Stack screenListeners={...} />` to sync tab bar visibility with stack transitions. */
export function useFloatingTabBarStackScreenListeners(): (props: {
  navigation: StackNavigationForTabBar
}) => {
  transitionStart: (event: { data?: { closing?: boolean } }) => void
  gestureCancel: () => void
} {
  const setTransitionOverride = useContext(TabBarTransitionContext)?.setTransitionOverride
  return useCallback(
    ({ navigation }) => ({
      transitionStart(event) {
        if (!setTransitionOverride) return
        const state = navigation.getState()
        if (!state) return
        const focused = state.routes[state.index]
        if (!focused) return

        if (event.data?.closing) {
          if (state.index <= 0) return
          const previous = state.routes[state.index - 1]
          if (!previous) return
          if (!tabBarHiddenForRouteName(String(focused.name))) return
          if (tabBarHiddenForRouteName(String(previous.name))) return
          setTransitionOverride("show")
          return
        }

        if (tabBarHiddenForRouteName(String(focused.name))) {
          setTransitionOverride("hide")
        }
      },
      gestureCancel() {
        setTransitionOverride?.(null)
      },
    }),
    [setTransitionOverride],
  )
}

/** Bottom space the root stack should keep clear while the floating bar is on screen. */
export function useFloatingTabBarClearance(): number {
  const pathname = usePathname()
  const insets = useSafeAreaInsets()
  const measured = useContext(TabBarHeightContext)?.height ?? 0
  // Match pathname only — not transition override. Early "show" on pop must not
  // shrink the stack mid-gesture (that exposed a full-width strip behind the pill).
  if (tabBarHidden(pathname)) return 0
  const barHeight = measured > 0 ? measured : TAB_BAR_FALLBACK_HEIGHT
  return barHeight + Math.max(insets.bottom, 8) + TAB_BAR_CONTENT_GAP
}

/** Bottom inset for scroll content on tab screens (stack is full-bleed; bar floats on top). */
export function useFloatingTabBarContentInset(): ViewStyle {
  const clearance = useFloatingTabBarClearance()
  return clearance > 0 ? { paddingBottom: clearance } : {}
}

type TabIcon = {
  ios: SFSymbol
  android: AndroidSymbol
}

type TabItem = {
  label: string
  icon: TabIcon
  activeIcon?: TabIcon
  href?: "/" | "/feed" | "/sell/new" | "/favorites" | "/account"
}

const TABS: TabItem[] = [
  {
    label: "Home",
    icon: { ios: "house", android: "home" },
    activeIcon: { ios: "house.fill", android: "home" },
    href: "/",
  },
  {
    label: "Feed",
    icon: { ios: "list.bullet.rectangle", android: "list_alt" },
    activeIcon: { ios: "list.bullet.rectangle.fill", android: "list_alt" },
    href: "/feed",
  },
  {
    label: "Sell",
    icon: { ios: "camera", android: "photo_camera" },
    activeIcon: { ios: "camera.fill", android: "photo_camera" },
    href: "/sell/new",
  },
  {
    label: "Favorites",
    icon: { ios: "heart", android: "favorite_border" },
    activeIcon: { ios: "heart.fill", android: "favorite" },
    href: "/favorites",
  },
  {
    label: "Me",
    icon: { ios: "person.crop.circle", android: "account_circle" },
    activeIcon: { ios: "person.crop.circle.fill", android: "account_circle" },
    href: "/account",
  },
]

function tabIsActive(pathname: string, href: TabItem["href"]): boolean {
  if (href === "/") return pathname === "/" || pathname === ""
  if (href === "/feed") return pathname === "/feed"
  if (href === "/sell/new") return pathname === "/sell" || pathname.startsWith("/sell/")
  if (href === "/favorites") return pathname === "/favorites"
  if (href === "/account") return pathname === "/account" || pathname.startsWith("/account/")
  return false
}

function isAccountTabRoot(pathname: string): boolean {
  return pathname === "/account" || pathname === "/account/"
}

function tabBarHidden(pathname: string): boolean {
  if (!isAccountTabRoot(pathname) && pathname.startsWith("/account/")) return true
  return (
    pathname.startsWith("/listing") ||
    pathname.startsWith("/track") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/seller-resources") ||
    pathname.startsWith("/sellers") ||
    pathname.startsWith("/help") ||
    pathname === "/safety" ||
    pathname === "/protection-policy" ||
    pathname === "/shipping-estimator" ||
    pathname.startsWith("/dropoff") ||
    pathname === "/sell" ||
    pathname.startsWith("/sell/") ||
    pathname === "/sign-in"
  )
}

/** Expo Router stack `route.name` — used before `usePathname()` updates on swipe-back. */
function tabBarHiddenForRouteName(name: string): boolean {
  if (name === "sign-in") return true
  if (name === "sell/index" || name === "sell/new" || name.startsWith("sell/")) return true
  if (name === "account/index") return false
  if (name.startsWith("account/")) return true
  if (name.startsWith("listing")) return true
  if (name.startsWith("track")) return true
  if (name.startsWith("profile")) return true
  if (name.startsWith("seller-resources")) return true
  if (name.startsWith("sellers")) return true
  if (name.startsWith("help")) return true
  if (name === "safety" || name === "protection-policy" || name === "shipping-estimator") return true
  if (name.startsWith("dropoff")) return true
  return false
}

function useFloatingTabBarShown(): boolean {
  const pathname = usePathname()
  const pathnameShowsBar = !tabBarHidden(pathname)
  const transition = useContext(TabBarTransitionContext)
  const transitionOverride = transition?.transitionOverride ?? null
  const setTransitionOverride = transition?.setTransitionOverride

  useEffect(() => {
    if (!setTransitionOverride || transitionOverride === null) return
    if (transitionOverride === "show" && pathnameShowsBar) setTransitionOverride(null)
    if (transitionOverride === "hide" && !pathnameShowsBar) setTransitionOverride(null)
  }, [pathnameShowsBar, setTransitionOverride, transitionOverride])

  if (transitionOverride === "show") return true
  if (transitionOverride === "hide") return false
  return pathnameShowsBar
}

const AUTH_TABS = new Set<TabItem["href"]>(["/sell/new", "/favorites", "/account"])

export function FloatingTabBar() {
  const pathname = usePathname()
  const shown = useFloatingTabBarShown()
  const router = useRouter()
  const { session } = useAuth()
  const { requestAuth } = useAuthGate()
  const colors = useReswellColors()
  const scheme = useColorScheme()
  const insets = useSafeAreaInsets()
  const tabBarHeight = useContext(TabBarHeightContext)

  if (!shown) return null

  const tabInk = colors.foreground
  const barSurface = colors.background
  const tabInkInactive =
    scheme === "dark" ? "rgba(250, 250, 250, 0.82)" : "rgba(4, 7, 14, 0.88)"

  const tabs = TABS.map((tab) => {
          const active = tabIsActive(pathname, tab.href)
          const color = active ? tabInk : tabInkInactive
          const icon = active && tab.activeIcon ? tab.activeIcon : tab.icon
          const body = (
            <View style={styles.item}>
              <SymbolView
                name={{ ios: icon.ios, android: icon.android, web: icon.android }}
                size={24}
                tintColor={color}
                weight={active ? "bold" : "semibold"}
              />
              <Text
                numberOfLines={1}
                style={[
                  styles.label,
                  active ? styles.labelActive : null,
                  { color, fontFamily: fontFamily.text },
                ]}
              >
                {tab.label}
              </Text>
            </View>
          )
          const href = tab.href
          if (!href) {
            return (
              <View key={tab.label} style={styles.press}>
                {body}
              </View>
            )
          }
          return (
            <Pressable
              key={tab.label}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => {
                if (AUTH_TABS.has(href) && !session?.access_token) {
                  requestAuth(() => router.navigate(href))
                  return
                }
                if (href === "/" && (pathname === "/" || pathname === "")) return
                if (href === "/feed" && pathname === "/feed") return
                if (href === "/sell/new" && (pathname === "/sell" || pathname.startsWith("/sell/"))) return
                if (href === "/favorites" && pathname === "/favorites") return
                if (href === "/account" && pathname === "/account") return
                router.navigate(href)
              }}
              style={styles.press}
            >
              {body}
            </Pressable>
          )
  })

  return (
    <View
      pointerEvents="box-none"
      onLayout={(event) => tabBarHeight?.setHeight(event.nativeEvent.layout.height)}
      style={[styles.wrap, { bottom: Math.max(insets.bottom, 8) }]}
    >
      <View style={styles.shadow}>
        <View
          style={[
            styles.bar,
            {
              backgroundColor: barSurface,
              borderColor: colors.border,
            },
          ]}
        >
          {tabs}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 14,
    right: 14,
    backgroundColor: "transparent",
  },
  shadow: {
    borderRadius: 32,
    backgroundColor: "transparent",
    ...Platform.select({
      ios: {
        shadowColor: "#000000",
        shadowOpacity: 0.1,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
      },
      android: {
        elevation: 6,
      },
    }),
  },
  bar: {
    borderRadius: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  press: { flex: 1, minHeight: 44 },
  item: { alignItems: "center", justifyContent: "center", gap: 2, paddingVertical: 2 },
  label: { fontSize: 12, fontWeight: "600" },
  labelActive: { fontWeight: "800" },
})
