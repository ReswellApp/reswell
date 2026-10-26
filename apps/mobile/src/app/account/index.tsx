import { Stack, useRouter } from "expo-router"
import { useCallback, useEffect, useState } from "react"
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { MeDashboardSections } from "@/components/me-dashboard-sections"
import { MeProfileHeader } from "@/components/me-profile-header"
import { ScreenSearchHeader } from "@/components/screen-search-header"
import { fetchDashboard, fetchEarnings } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useAuthGate } from "@/lib/auth-gate"
import { dashboardPageHref } from "@/lib/dashboard-pages"
import { useAccountResource } from "@/lib/use-account-resource"
import { fontFamily, useReswellColors } from "@/theme"

export default function AccountScreen() {
  const colors = useReswellColors()
  const router = useRouter()
  const { session, signOut } = useAuth()
  const { requestAuth } = useAuthGate()
  const token = session?.access_token
  const loadDashboard = useCallback((accessToken: string) => fetchDashboard(accessToken), [])
  const dashboardResource = useAccountResource(loadDashboard)
  const [last30Label, setLast30Label] = useState<string | null>(null)

  const dashboard = dashboardResource.data
  const slug = dashboard?.seller_slug ?? null

  useEffect(() => {
    if (!token) {
      setLast30Label(null)
      return
    }
    let cancelled = false
    fetchEarnings(token)
      .then((earnings) => {
        if (!cancelled) setLast30Label(earnings.earned_last_30d_label)
      })
      .catch(() => {
        if (!cancelled) setLast30Label(null)
      })
    return () => {
      cancelled = true
    }
  }, [token])

  if (!token) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenSearchHeader showBack showInbox insetTop bordered={false} />
        <View style={[styles.signedOut, { paddingTop: 24 }]}>
        <Text style={[styles.signedOutTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>Sign in</Text>
        <Pressable onPress={() => requestAuth()} style={[styles.sell, { backgroundColor: colors.primary }]}>
          <Text style={[styles.sellLabel, { color: colors.primaryForeground, fontFamily: fontFamily.text }]}>Sign in</Text>
        </Pressable>
        </View>
      </View>
    )
  }

  const name = dashboard?.display_name || "Account"
  const sellerProfileHref = slug ? dashboardPageHref("seller-profile", slug) : null

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenSearchHeader showBack showInbox insetTop bordered={false} />
      {dashboardResource.error && !dashboard ? (
        <View style={styles.centered}>
          <Text style={[styles.error, { color: colors.foreground, fontFamily: fontFamily.text }]}>{dashboardResource.error}</Text>
          <Pressable onPress={() => dashboardResource.reload()}>
            <Text style={[styles.retry, { color: colors.foreground, fontFamily: fontFamily.text }]}>Try again</Text>
          </Pressable>
        </View>
      ) : dashboardResource.loading && !dashboard ? (
        <ActivityIndicator style={styles.centered} color={colors.foreground} />
      ) : dashboard ? (
        <ScrollView showsVerticalScrollIndicator={false}>
          <MeProfileHeader
            displayName={name}
            username={slug}
            avatarUrl={dashboard.avatar_url}
            websiteUrl={dashboard.website_url}
            onSellerProfile={sellerProfileHref ? () => router.push(sellerProfileHref) : undefined}
            sellerProfileLabel={sellerProfileHref ? "View my seller profile" : undefined}
          />
          <MeDashboardSections
            dashboard={dashboard}
            last30Label={last30Label}
            onSignOut={() => {
              void signOut().then(() => router.replace("/account"))
            }}
          />
        </ScrollView>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  signedOut: { justifyContent: "center", paddingHorizontal: 24, gap: 16 },
  signedOutTitle: { fontSize: 32, fontWeight: "700" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  error: { textAlign: "center", fontSize: 15, lineHeight: 21 },
  retry: { fontSize: 16, fontWeight: "700", textDecorationLine: "underline" },
  sell: { borderRadius: 999, paddingHorizontal: 22, minHeight: 44, alignItems: "center", justifyContent: "center" },
  sellLabel: { fontSize: 16, fontWeight: "700" },
})
