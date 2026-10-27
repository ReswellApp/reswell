import { useFonts } from "expo-font"
import { Stack } from "expo-router"
import { View } from "react-native"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import {
  FloatingTabBar,
  FloatingTabBarInsetProvider,
  useFloatingTabBarStackScreenListeners,
} from "@/components/floating-tab-bar"
import { AuthGateProvider } from "@/lib/auth-gate"
import { AuthProvider } from "@/lib/auth-context"
import { CartCountProvider } from "@/lib/cart-count"
import { ListingMarksProvider } from "@/lib/listing-marks"
import { useReswellColors, fontFamily } from "@/theme"

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    StackSansHeadline: require("../../assets/fonts/stack-sans-headline-latin.ttf"),
    StackSansText: require("../../assets/fonts/stack-sans-text-latin.ttf"),
  })

  if (!fontsLoaded && !fontError) return null

  const type = fontError ? undefined : fontFamily.headline

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <AuthProvider>
      <AuthGateProvider>
      <ListingMarksProvider>
      <CartCountProvider>
        <FloatingTabBarInsetProvider>
          <AppShell titleFont={type} />
        </FloatingTabBarInsetProvider>
      </CartCountProvider>
      </ListingMarksProvider>
      </AuthGateProvider>
    </AuthProvider>
    </GestureHandlerRootView>
  )
}

function AppShell({ titleFont }: { titleFont: string | undefined }) {
  const colors = useReswellColors()
  const tabBarStackScreenListeners = useFloatingTabBarStackScreenListeners()

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack
        screenListeners={tabBarStackScreenListeners}
        screenOptions={{
          headerShadowVisible: false,
          headerBackButtonDisplayMode: "minimal",
          headerTintColor: colors.foreground,
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: { fontFamily: titleFont, fontWeight: "600", color: colors.foreground },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerLargeTitle: false }} />
        <Stack.Screen name="listing/[id]" options={{ title: "" }} />
        <Stack.Screen name="category/[slug]" options={{ title: "" }} />
        <Stack.Screen name="profile/[slug]" options={{ title: "" }} />
        <Stack.Screen name="sign-in" options={{ title: "Sign in", presentation: "modal" }} />
      </Stack>
      <FloatingTabBar />
    </View>
  )
}
