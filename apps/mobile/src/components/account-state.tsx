import { Stack } from "expo-router"
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import type { ReactNode } from "react"
import { useFloatingTabBarClearance } from "@/components/floating-tab-bar"
import { SCROLL_END_PADDING } from "@/components/screen-shell"
import { fontFamily, useReswellColors } from "@/theme"

/** Keeps list and scroll content above the floating tab bar or home indicator on account stack screens. */
function useAccountBodyBottomPadding(): number {
  const tabClearance = useFloatingTabBarClearance()
  const insets = useSafeAreaInsets()
  if (tabClearance > 0) return tabClearance
  return Math.max(insets.bottom, 8) + SCROLL_END_PADDING
}

export function AccountState({
  title,
  loading,
  error,
  onRetry,
  empty,
  isEmpty,
  edgeToEdgeBottom = false,
  children,
}: {
  title: string
  loading: boolean
  error: string | null
  onRetry: () => void
  empty: string
  isEmpty: boolean
  /** Skip bottom inset when the screen owns sticky footer or composer chrome to the home indicator. */
  edgeToEdgeBottom?: boolean
  children: ReactNode
}) {
  const colors = useReswellColors()
  const bodyBottomPadding = useAccountBodyBottomPadding()

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title }} />
      {loading && isEmpty ? (
        <ActivityIndicator style={styles.centered} color={colors.foreground} />
      ) : error && isEmpty ? (
        <View style={styles.centered}>
          <Text style={[styles.message, { color: colors.foreground, fontFamily: fontFamily.text }]}>{error}</Text>
          <Pressable onPress={onRetry}>
            <Text style={[styles.retry, { color: colors.foreground, fontFamily: fontFamily.text }]}>Try again</Text>
          </Pressable>
        </View>
      ) : isEmpty ? (
        <Text style={[styles.message, styles.centered, { color: colors.muted, fontFamily: fontFamily.text }]}>{empty}</Text>
      ) : (
        <View style={[styles.body, !edgeToEdgeBottom && { paddingBottom: bodyBottomPadding }]}>{children}</View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  message: { fontSize: 16, textAlign: "center" },
  retry: { fontSize: 16, fontWeight: "600" },
})
