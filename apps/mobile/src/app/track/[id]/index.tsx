import { Stack, useLocalSearchParams } from "expo-router"
import { useCallback, useEffect, useRef, useState } from "react"
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native"
import type { MobileTrackPackage } from "@reswell/api-contract"
import { ScreenScroll, ScreenShell } from "@/components/screen-shell"
import { TrackPackageView } from "@/components/track/track-package-view"
import { fetchTrackPackage } from "@/lib/api"
import { fontFamily, useReswellColors } from "@/theme"

const POLL_MS = 45_000

export default function TrackPackageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const colors = useReswellColors()
  const [page, setPage] = useState<MobileTrackPackage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const pageRef = useRef(page)
  pageRef.current = page

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      const orderId = id?.trim() ?? ""
      if (!orderId) {
        setError("Missing order")
        setLoading(false)
        return
      }

      const hasPage = Boolean(pageRef.current)
      if (!opts?.silent) {
        if (hasPage) setRefreshing(true)
        else setLoading(true)
      }

      try {
        const next = await fetchTrackPackage(orderId)
        setPage(next)
        setError(null)
        setRefreshError(null)
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : "Unable to load tracking"
        if (pageRef.current) setRefreshError(message)
        else setError(message)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [id],
  )

  useEffect(() => {
    void load()
  }, [load, attempt])

  useEffect(() => {
    if (!page?.live) return
    const timer = setInterval(() => {
      void load({ silent: true })
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [load, page?.live])

  return (
    <ScreenShell style={{ backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: "Track package" }} />
      {loading && !page ? (
        <ActivityIndicator style={styles.centered} color={colors.foreground} />
      ) : error || !page ? (
        <View style={styles.centered}>
          <Text style={[styles.message, { color: colors.foreground, fontFamily: fontFamily.text }]}>
            {error ?? "Tracking is not available."}
          </Text>
          <Pressable onPress={() => setAttempt((current) => current + 1)}>
            <Text style={[styles.retry, { color: colors.foreground, fontFamily: fontFamily.text }]}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <ScreenScroll
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void load()}
              tintColor={colors.foreground}
            />
          }
        >
          <TrackPackageView
            page={page}
            refreshing={refreshing}
            refreshError={refreshError}
            onRefresh={() => void load()}
          />
        </ScreenScroll>
      )}
    </ScreenShell>
  )
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  message: { fontSize: 16, textAlign: "center" },
  retry: { fontSize: 16, fontWeight: "600" },
})
