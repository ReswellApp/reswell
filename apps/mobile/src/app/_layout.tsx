import { useFonts } from "expo-font"
import { Stack } from "expo-router"
import { View } from "react-native"
import { FloatingTabBar } from "@/components/floating-tab-bar"
import { AuthProvider } from "@/lib/auth-context"
import { useReswellColors, fontFamily } from "@/theme"

export default function RootLayout() {
  const colors = useReswellColors()
  const [fontsLoaded, fontError] = useFonts({
    StackSansHeadline: require("../../assets/fonts/stack-sans-headline-latin.ttf"),
    StackSansText: require("../../assets/fonts/stack-sans-text-latin.ttf"),
  })

  if (!fontsLoaded && !fontError) return null

  const type = fontError ? undefined : fontFamily.headline

  return (
    <AuthProvider>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Stack
          screenOptions={{
            headerShadowVisible: false,
            headerBackButtonDisplayMode: "minimal",
            headerTintColor: colors.foreground,
            headerStyle: { backgroundColor: colors.background },
            headerTitleStyle: { fontFamily: type, fontWeight: "600", color: colors.foreground },
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="index" options={{ headerLargeTitle: false }} />
          <Stack.Screen name="listing/[id]" options={{ title: "" }} />
          <Stack.Screen name="profile/[slug]" options={{ title: "" }} />
          <Stack.Screen name="sign-in" options={{ title: "Sign in", presentation: "modal" }} />
        </Stack>
        <FloatingTabBar />
      </View>
    </AuthProvider>
  )
}
