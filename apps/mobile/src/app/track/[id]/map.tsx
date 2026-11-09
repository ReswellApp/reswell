import { Image } from "expo-image"
import { Stack, useLocalSearchParams } from "expo-router"
import { useEffect, useState } from "react"
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native"
import { ScreenShell } from "@/components/screen-shell"
import { fetchTrackPackage } from "@/lib/api"
import { fontFamily, useReswellColors } from "@/theme"

export default function TrackMapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const colors = useReswellColors()
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [summary, setSummary] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    const orderId = id?.trim() ?? ""
    if (!orderId) {
      setError("Missing order")
      return
    }
    setError(null)
    fetchTrackPackage(orderId)
      .then((page) => {
        if (cancelled) return
        const url = page.map?.image_url?.trim() || null
        setImageUrl(url)
        setSummary(page.map?.summary ?? null)
        setError(url ? null : "Map is not available yet.")
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load the map")
      })
    return () => {
      cancelled = true
    }
  }, [id, attempt])

  return (
    <ScreenShell style={{ backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: "Shipment map" }} />
      {error && !imageUrl ? (
        <View style={styles.centered}>
          <Text style={[styles.message, { color: colors.foreground, fontFamily: fontFamily.text }]}>{error}</Text>
          <Pressable onPress={() => setAttempt((current) => current + 1)}>
            <Text style={[styles.retry, { color: colors.foreground, fontFamily: fontFamily.text }]}>Try again</Text>
          </Pressable>
        </View>
      ) : imageUrl ? (
        <View style={styles.page}>
          {summary ? (
            <Text style={[styles.summary, { color: colors.muted, fontFamily: fontFamily.text }]}>{summary}</Text>
          ) : null}
          <Image
            source={{ uri: imageUrl }}
            style={[styles.map, { backgroundColor: colors.image }]}
            contentFit="contain"
            accessibilityLabel={summary ?? "Shipment map"}
          />
        </View>
      ) : (
        <ActivityIndicator style={styles.centered} color={colors.foreground} />
      )}
    </ScreenShell>
  )
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  page: { flex: 1, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 12 },
  summary: { fontSize: 14, lineHeight: 20 },
  map: { flex: 1, borderRadius: 16, borderCurve: "continuous" },
  message: { fontSize: 16, textAlign: "center" },
  retry: { fontSize: 16, fontWeight: "600" },
})
