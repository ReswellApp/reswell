import { Stack } from "expo-router"
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native"
import type { ReactNode } from "react"
import { fontFamily, useReswellColors } from "@/theme"

export function AccountState({
  title,
  loading,
  error,
  onRetry,
  empty,
  isEmpty,
  children,
}: {
  title: string
  loading: boolean
  error: string | null
  onRetry: () => void
  empty: string
  isEmpty: boolean
  children: ReactNode
}) {
  const colors = useReswellColors()

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
        children
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  message: { fontSize: 16, textAlign: "center" },
  retry: { fontSize: 16, fontWeight: "600" },
})
