import { Stack, useRouter } from "expo-router"
import { useCallback } from "react"
import { Pressable, ScrollView, StyleSheet, Text } from "react-native"
import { AccountState } from "@/components/account-state"
import { DashboardMenuIcon } from "@/components/dashboard-menu-icon"
import { fetchDashboard } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { dashboardPageHref } from "@/lib/dashboard-pages"
import { useAccountResource } from "@/lib/use-account-resource"
import { fontFamily, useReswellColors } from "@/theme"

export default function AccountMenuScreen() {
  const colors = useReswellColors()
  const router = useRouter()
  const { signOut } = useAuth()
  const loadDashboard = useCallback((accessToken: string) => fetchDashboard(accessToken), [])
  const { data, error, loading, reload } = useAccountResource(loadDashboard)
  const pages = data?.pages ?? []

  return (
    <AccountState
      title="Account"
      loading={loading}
      error={error}
      onRetry={reload}
      empty="No account pages are available."
      isEmpty={pages.length === 0}
    >
      <Stack.Screen options={{ title: "Account" }} />
      <ScrollView contentContainerStyle={styles.list}>
        {pages.map((page) => (
          <Pressable
            key={page.id}
            onPress={() => {
              if (page.id === "overview") {
                if (router.canGoBack()) router.back()
                else router.replace("/account")
                return
              }
              const href = dashboardPageHref(page.id, data?.seller_slug ?? null)
              if (href) router.push(href)
            }}
            style={styles.row}
          >
            <DashboardMenuIcon id={page.id} color={colors.muted} />
            <Text style={[styles.label, { color: colors.foreground, fontFamily: fontFamily.text }]}>{page.label}</Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() => {
            void signOut().then(() => router.replace("/account"))
          }}
          style={styles.row}
        >
          <Text style={[styles.label, { color: colors.destructive, fontFamily: fontFamily.text }]}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </AccountState>
  )
}

const styles = StyleSheet.create({
  list: { paddingVertical: 8, paddingBottom: 120 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingVertical: 14 },
  label: { fontSize: 17, fontWeight: "600" },
})
