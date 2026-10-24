import { SymbolView } from "expo-symbols"
import { useRouter, type Href } from "expo-router"
import { Pressable, StyleSheet, Text, View } from "react-native"
import type { MobileDashboard, MobileDashboardPage } from "@reswell/api-contract"
import { DashboardMenuIcon } from "@/components/dashboard-menu-icon"
import { MeStatTile } from "@/components/me-stat-tile"
import { DashboardAttention } from "@/components/dashboard-attention"
import { dashboardPageHref } from "@/lib/dashboard-pages"
import { groupMeDashboardPages } from "@/lib/dashboard-page-sections"
import { fontFamily, useReswellColors } from "@/theme"

export function MeDashboardSections({
  dashboard,
  last30Label,
  onSignOut,
}: {
  dashboard: MobileDashboard
  last30Label: string | null
  onSignOut: () => void
}) {
  const colors = useReswellColors()
  const router = useRouter()
  const slug = dashboard.seller_slug
  const { selling, buying, account } = groupMeDashboardPages(dashboard.pages)

  function openPage(page: MobileDashboardPage) {
    const href = dashboardPageHref(page.id, slug)
    if (href) router.push(href)
  }

  function openHref(href: Href) {
    router.push(href)
  }

  return (
    <View style={styles.stack}>
      <View style={styles.earningsRow}>
        <MeStatTile
          accentValue
          label="Lifetime earnings"
          value={dashboard.earnings_lifetime_label}
          onPress={() => router.push("/account/earnings")}
        />
        <MeStatTile
          accentValue
          label="Last 30 days"
          value={last30Label ?? "—"}
          onPress={() => router.push("/account/earnings")}
        />
        <MeStatTile
          accentValue
          label="Available"
          value={dashboard.wallet_balance_label}
          onPress={() => router.push("/account/earnings")}
        />
      </View>
      <DashboardAttention data={dashboard} onOpen={openHref} />
      <DashboardSection title="Selling" pages={selling} onOpen={openPage} />
      <DashboardSection title="Buying" pages={buying} onOpen={openPage} />
      {account.length > 0 ? <DashboardSection title="Account" pages={account} onOpen={openPage} /> : null}
      <Pressable accessibilityRole="button" onPress={onSignOut} style={styles.signOut}>
        <Text style={[styles.signOutLabel, { color: colors.destructive, fontFamily: fontFamily.text }]}>Sign out</Text>
      </Pressable>
    </View>
  )
}

function DashboardSection({
  title,
  pages,
  onOpen,
}: {
  title: string
  pages: MobileDashboardPage[]
  onOpen: (page: MobileDashboardPage) => void
}) {
  const colors = useReswellColors()
  if (pages.length === 0) return null
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>{title}</Text>
      <View style={[styles.sectionCard, { borderColor: colors.border, backgroundColor: colors.background }]}>
        {pages.map((page, index) => (
          <Pressable
            key={page.id}
            accessibilityRole="button"
            onPress={() => onOpen(page)}
            style={[styles.menuRow, index > 0 ? { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth } : null]}
          >
            <DashboardMenuIcon id={page.id} color={colors.foreground} />
            <Text style={[styles.menuLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>{page.label}</Text>
            <SymbolView
              name={{ ios: "chevron.right", android: "chevron_right", web: "chevron_right" }}
              size={16}
              tintColor={colors.muted}
            />
          </Pressable>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  stack: { gap: 8, paddingBottom: 32 },
  earningsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 2,
    gap: 6,
  },
  section: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  sectionTitle: { fontSize: 22, fontWeight: "700" },
  sectionCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, overflow: "hidden" },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  menuLabel: { flex: 1, fontSize: 16, fontWeight: "600" },
  signOut: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
  signOutLabel: { fontSize: 17, fontWeight: "700" },
})
