import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from "expo-glass-effect"
import { SymbolView, type AndroidSymbol } from "expo-symbols"
import { usePathname, useRouter } from "expo-router"
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import { Pressable, StyleSheet, Text, useColorScheme, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import type { SFSymbol } from "sf-symbols-typescript"
import { useAuth } from "@/lib/auth-context"
import { useAuthGate } from "@/lib/auth-gate"
import { fontFamily, useReswellColors } from "@/theme"

/** Used until the bar reports its laid-out height. Icon, label, and vertical padding. */
const TAB_BAR_FALLBACK_HEIGHT = 58
/** Space between scroll content and the top of the bar. */
const TAB_BAR_CONTENT_GAP = 12

const TabBarHeightContext = createContext<{
  height: number
  setHeight: (height: number) => void
} | null>(null)

export function FloatingTabBarInsetProvider({ children }: { children: ReactNode }) {
  const [height, setBarHeight] = useState(0)
  const setHeight = useCallback((next: number) => {
    setBarHeight((current) => (current === next ? current : next))
  }, [])
  const value = useMemo(() => ({ height, setHeight }), [height, setHeight])
  return <TabBarHeightContext.Provider value={value}>{children}</TabBarHeightContext.Provider>
}

/** Bottom space the root stack should keep clear while the floating bar is on screen. */
export function useFloatingTabBarClearance(): number {
  const pathname = usePathname()
  const insets = useSafeAreaInsets()
  const measured = useContext(TabBarHeightContext)?.height ?? 0
  if (tabBarHidden(pathname)) return 0
  const barHeight = measured > 0 ? measured : TAB_BAR_FALLBACK_HEIGHT
  return barHeight + Math.max(insets.bottom, 8) + TAB_BAR_CONTENT_GAP
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

function tabBarHidden(pathname: string): boolean {
  return (
    pathname.startsWith("/listing") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/seller-resources") ||
    pathname.startsWith("/sellers") ||
    pathname === "/sell" ||
    pathname.startsWith("/sell/") ||
    pathname.startsWith("/account/messages/") ||
    pathname.startsWith("/account/cart") ||
    pathname.startsWith("/account/checkout") ||
    pathname === "/sign-in"
  )
}

const AUTH_TABS = new Set<TabItem["href"]>(["/sell/new", "/favorites", "/account"])

export function FloatingTabBar() {
  const pathname = usePathname()
  const router = useRouter()
  const { session } = useAuth()
  const { requestAuth } = useAuthGate()
  const colors = useReswellColors()
  const scheme = useColorScheme()
  const insets = useSafeAreaInsets()
  const tabBarHeight = useContext(TabBarHeightContext)

  if (tabBarHidden(pathname)) return null

  const glass = isLiquidGlassAvailable() && isGlassEffectAPIAvailable()
  const tabInk = colors.foreground
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
        {glass ? (
          <GlassView
            glassEffectStyle="regular"
            style={styles.bar}
            tintColor={scheme === "dark" ? "rgba(26,26,26,0.88)" : "rgba(255,255,255,0.92)"}
          >
            {tabs}
          </GlassView>
        ) : (
          <View
            style={[
              styles.bar,
              { backgroundColor: scheme === "dark" ? "rgba(26,26,26,0.88)" : "rgba(255,255,255,0.92)" },
            ]}
          >
            {tabs}
          </View>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 14,
    right: 14,
  },
  shadow: {
    borderRadius: 32,
    shadowColor: "#000000",
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  bar: {
    borderRadius: 32,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  press: { flex: 1, minHeight: 44 },
  item: { alignItems: "center", justifyContent: "center", gap: 2, paddingVertical: 2 },
  label: { fontSize: 12, fontWeight: "600" },
  labelActive: { fontWeight: "800" },
})
