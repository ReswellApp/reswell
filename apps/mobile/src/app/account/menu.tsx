import { Stack, useRouter, type Href } from "expo-router"
import { useCallback } from "react"
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import type { MobileDashboard } from "@reswell/api-contract"
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
      title="Dashboard"
      loading={loading}
      error={error}
      onRetry={reload}
      empty="No account pages are available."
      isEmpty={pages.length === 0}
    >
      <Stack.Screen options={{ title: "Dashboard" }} />
      <ScrollView contentContainerStyle={styles.list}>
        <Attention data={data} onOpen={(href) => router.push(href)} />
        {pages.filter((page) => page.id !== "overview").map((page) => (
          <Pressable
            key={page.id}
            onPress={() => {
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

function Attention({ data, onOpen }: { data: MobileDashboard | null; onOpen: (href: Href) => void }) {
  const colors = useReswellColors()
  if (!data) return null
  const items: { label: string; href: Href }[] = []
  if (data.pending_offer_count > 0) {
    items.push({
      label: data.pending_offer_count === 1 ? "1 offer needs you" : `${data.pending_offer_count} offers need you`,
      href: "/account/offers",
    })
  }
  if (data.unread_message_count > 0) {
    items.push({
      label: data.unread_message_count === 1 ? "1 unread message" : `${data.unread_message_count} unread messages`,
      href: "/account/messages",
    })
  }
  if (data.wallet_balance_usd > 0) {
    items.push({ label: `${data.wallet_balance_label} ready to cash out`, href: "/account/earnings" })
  }

  return (
    <View style={styles.attention}>
      <Text style={[styles.attentionTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>Needs you</Text>
      {items.length === 0 ? (
        <Text style={[styles.quiet, { color: colors.muted, fontFamily: fontFamily.text }]}>Nothing needs you right now.</Text>
      ) : (
        items.map((item) => (
          <Pressable key={item.label} onPress={() => onOpen(item.href)} style={styles.attentionRow}>
            <Text style={[styles.label, { color: colors.foreground, fontFamily: fontFamily.text }]}>{item.label}</Text>
          </Pressable>
        ))
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  attention: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 4 },
  attentionTitle: { fontSize: 22, fontWeight: "700", marginBottom: 4 },
  attentionRow: { paddingVertical: 10 },
  quiet: { fontSize: 15, lineHeight: 21, paddingVertical: 6 },
  list: { paddingVertical: 8, paddingBottom: 120 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingVertical: 14 },
  label: { fontSize: 17, fontWeight: "600" },
})
