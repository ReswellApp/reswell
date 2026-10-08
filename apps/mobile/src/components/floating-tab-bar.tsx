import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from "expo-glass-effect"
import { SymbolView, type AndroidSymbol } from "expo-symbols"
import { usePathname, useRouter } from "expo-router"
import { Pressable, StyleSheet, Text, useColorScheme, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import type { SFSymbol } from "sf-symbols-typescript"
import { fontFamily, useReswellColors } from "@/theme"

type TabIcon = {
  ios: SFSymbol
  android: AndroidSymbol
}

type TabItem = {
  label: string
  icon: TabIcon
  activeIcon?: TabIcon
  href?: "/" | "/account"
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
  },
  {
    label: "Sell",
    icon: { ios: "camera", android: "photo_camera" },
  },
  {
    label: "Shops",
    icon: { ios: "storefront", android: "storefront" },
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
  if (href === "/account") return pathname === "/account" || pathname.startsWith("/account/")
  return false
}

function tabBarHidden(pathname: string): boolean {
  return (
    pathname.startsWith("/listing") ||
    pathname.startsWith("/profile") ||
    pathname === "/sign-in"
  )
}

export function FloatingTabBar() {
  const pathname = usePathname()
  const router = useRouter()
  const colors = useReswellColors()
  const scheme = useColorScheme()
  const insets = useSafeAreaInsets()

  if (tabBarHidden(pathname)) return null

  const glass = isLiquidGlassAvailable() && isGlassEffectAPIAvailable()
  const tabs = TABS.map((tab) => {
          const active = tabIsActive(pathname, tab.href)
          const color = active ? colors.foreground : colors.muted
          const icon = active && tab.activeIcon ? tab.activeIcon : tab.icon
          const body = (
            <View style={styles.item}>
              <SymbolView
                name={{ ios: icon.ios, android: icon.android, web: icon.android }}
                size={24}
                tintColor={color}
                weight={active ? "semibold" : "regular"}
              />
              <Text style={[styles.label, { color, fontFamily: fontFamily.text }]}>{tab.label}</Text>
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
                if (href === "/" && (pathname === "/" || pathname === "")) return
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
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.shadow}>
        {glass ? (
          <GlassView
            glassEffectStyle="regular"
            style={styles.bar}
            tintColor={scheme === "dark" ? "rgba(26,26,26,0.9)" : "rgba(242,243,247,0.92)"}
          >
            {tabs}
          </GlassView>
        ) : (
          <View
            style={[
              styles.bar,
              { backgroundColor: scheme === "dark" ? "rgba(26,26,26,0.92)" : "rgba(242,243,247,0.94)" },
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
    left: 28,
    right: 28,
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
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  press: { flex: 1 },
  item: { alignItems: "center", gap: 2, paddingVertical: 2 },
  label: { fontSize: 11, fontWeight: "600" },
})
