import { SymbolView } from "expo-symbols"
import { useRouter } from "expo-router"
import { Pressable, StyleSheet, Text, View } from "react-native"
import type { MobileDashboard, MobileDashboardPage } from "@reswell/api-contract"
import { DashboardMenuIcon } from "@/components/dashboard-menu-icon"
import { MeStatTile } from "@/components/me-stat-tile"
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

  return (
    <View style={styles.stack}>
      <View style={[styles.earningsRow, { borderTopColor: colors.border }]}>
        <MeStatTile
          plain
          accentValue
          label={"Lifetime\nEarnings"}
          value={dashboard.earnings_lifetime_label}
          onPress={() => router.push("/account/earnings")}
        />
        <View style={[styles.earningsDivider, { backgroundColor: colors.border }]} />
        <MeStatTile
          plain
          accentValue
          label={"Last\n30 Days"}
          value={last30Label ?? "—"}
          onPress={() => router.push("/account/earnings")}
        />
        <View style={[styles.earningsDivider, { backgroundColor: colors.border }]} />
        <MeStatTile
          plain
          accentValue
          label={"Available\nEarnings"}
          value={dashboard.wallet_balance_label}
          onPress={() => router.push("/account/earnings")}
        />
      </View>
      <DashboardSection title="Selling" pages={selling} onOpen={openPage} />
      <DashboardSection title="Buying" pages={buying} onOpen={openPage} />
      {account.length > 0 ? <DashboardSection title="Account" pages={account} onOpen={openPage} /> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        onPress={onSignOut}
        style={({ pressed }) => [
          styles.signOut,
          {
            borderColor: colors.border,
            backgroundColor: pressed ? colors.secondary : colors.background,
          },
        ]}
      >
        <SymbolView
          name={{ ios: "rectangle.portrait.and.arrow.right", android: "logout", web: "logout" }}
          size={18}
          tintColor={colors.destructive}
        />
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
    alignItems: "flex-start",
    marginHorizontal: 8,
    marginTop: 4,
    paddingTop: 16,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  earningsDivider: {
    width: StyleSheet.hairlineWidth,
    height: 22,
    marginTop: 5,
    opacity: 0.7,
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
  signOut: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  signOutLabel: { fontSize: 16, fontWeight: "700" },
})
