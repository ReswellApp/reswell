import { Image } from "expo-image"
import { useRouter } from "expo-router"
import { SymbolView } from "expo-symbols"
import { useCallback, useState, type ReactNode } from "react"
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import type { MobileEarnings } from "@reswell/api-contract"
import { DashboardPageGate } from "@/components/dashboard-page-gate"
import { EarningsTransfer } from "@/components/earnings-transfer"
import { fetchEarnings } from "@/lib/api"
import { helpTopicHref } from "@/lib/in-app-href"
import { useAccountResource } from "@/lib/use-account-resource"
import { fontFamily, useReswellColors } from "@/theme"

type EarningsLine = MobileEarnings["activity"][number]
type EarningsPane = "menu" | "pending" | "available" | "activity" | "transfer"
type ActivityFilter = "all" | "pending" | "ready" | "payout" | "refund"

const ACTIVITY_FILTERS: { id: ActivityFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "ready", label: "Ready" },
  { id: "payout", label: "Payouts" },
  { id: "refund", label: "Refunds" },
]

export default function AccountEarningsScreen() {
  const colors = useReswellColors()
  const load = useCallback((accessToken: string) => fetchEarnings(accessToken), [])
  const earnings = useAccountResource(load)
  const [pane, setPane] = useState<EarningsPane>("menu")

  return (
    <DashboardPageGate
      id="earnings"
      title="Earnings"
      onBack={pane === "menu" ? undefined : pane === "transfer" ? () => setPane("available") : () => setPane("menu")}
    >
      {() => (
        <ScrollView style={styles.screen} contentInsetAdjustmentBehavior="never">
          {earnings.loading && !earnings.data ? (
            <Text style={[styles.loading, { color: colors.muted, fontFamily: fontFamily.text }]}>Loading earnings…</Text>
          ) : earnings.error && !earnings.data ? (
            <Text style={[styles.loading, { color: colors.foreground, fontFamily: fontFamily.text }]}>{earnings.error}</Text>
          ) : earnings.data ? (
            pane === "pending" ? (
              <PendingRelease data={earnings.data} />
            ) : pane === "available" ? (
              <AvailableBalance data={earnings.data} onTransfer={() => setPane("transfer")} />
            ) : pane === "activity" ? (
              <ActivityHistory items={earnings.data.activity} />
            ) : pane === "transfer" ? (
              <EarningsTransfer
                data={earnings.data}
                onReload={earnings.reload}
                onDone={() => setPane("available")}
              />
            ) : (
              <EarningsMenu data={earnings.data} onOpen={setPane} />
            )
          ) : null}
        </ScrollView>
      )}
    </DashboardPageGate>
  )
}

function EarningsMenu({ data, onOpen }: { data: MobileEarnings; onOpen: (pane: EarningsPane) => void }) {
  const colors = useReswellColors()
  const router = useRouter()

  return (
    <View>
      <Text style={[styles.pageTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>Earnings</Text>
      <EarningsLink
        icon={<SymbolView name={{ ios: "clock.fill", android: "schedule", web: "schedule" }} size={16} tintColor={colors.background} />}
        title="Pending Release"
        amount={data.pending_label}
        onPress={() => onOpen("pending")}
      />
      <View style={[styles.rule, { backgroundColor: colors.border }]} />
      <EarningsLink
        icon={<SymbolView name={{ ios: "checkmark", android: "check", web: "check" }} size={16} tintColor={colors.background} />}
        title="Available"
        amount={data.ready_label}
        onPress={() => onOpen("available")}
      />
      <View style={[styles.rule, { backgroundColor: colors.border }]} />
      <EarningsLink
        icon={<SymbolView name={{ ios: "list.bullet", android: "list", web: "list" }} size={16} tintColor={colors.background} />}
        title="Activity"
        onPress={() => onOpen("activity")}
      />
      <View style={[styles.rule, { backgroundColor: colors.border }]} />
      <EarningsLink
        icon={<SymbolView name={{ ios: "dollarsign", android: "attach_money", web: "attach_money" }} size={16} tintColor={colors.background} />}
        title="Earnings FAQ"
        onPress={() => router.push(helpTopicHref("selling"))}
      />
      <View style={[styles.rule, { backgroundColor: colors.border }]} />
    </View>
  )
}

function EarningsLink({
  icon,
  title,
  amount,
  onPress,
}: {
  icon: ReactNode
  title: string
  amount?: string
  onPress: () => void
}) {
  const colors = useReswellColors()
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.link}>
      <View style={[styles.iconCircle, { backgroundColor: colors.foreground }]}>{icon}</View>
      <View style={styles.linkCopy}>
        <Text style={[styles.linkTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>{title}</Text>
        {amount ? (
          <Text style={[styles.linkAmount, { color: colors.foreground, fontFamily: fontFamily.text }]}>{amount}</Text>
        ) : null}
      </View>
      <SymbolView
        name={{ ios: "chevron.right", android: "chevron_right", web: "chevron_right" }}
        size={16}
        tintColor={colors.foreground}
      />
    </Pressable>
  )
}

function PendingRelease({ data }: { data: MobileEarnings }) {
  const colors = useReswellColors()
  const empty = data.pending_usd <= 0
  return (
    <View>
      <View style={[styles.balanceBand, { backgroundColor: "#E7EEF8" }]}>
        <Text style={[styles.balanceEyebrow, { color: colors.listingHeart, fontFamily: fontFamily.text }]}>Total pending</Text>
        <Text style={[styles.balanceAmount, { color: colors.foreground, fontFamily: fontFamily.headline }]}>{data.pending_label}</Text>
      </View>
      {empty ? (
        <EarningsEmpty
          title="No earnings pending"
          body="When you sell a board and the buyer pays, your pending earnings will appear here."
        />
      ) : (
        <EarningsLineList items={data.pending_items} />
      )}
    </View>
  )
}

function AvailableBalance({ data, onTransfer }: { data: MobileEarnings; onTransfer: () => void }) {
  const colors = useReswellColors()
  const empty = data.ready_usd <= 0
  return (
    <View>
      <View style={[styles.balanceBand, { backgroundColor: colors.secondary }]}>
        <Text style={[styles.balanceEyebrow, { color: colors.listingHeart, fontFamily: fontFamily.text }]}>Available balance</Text>
        <Text style={[styles.balanceAmount, { color: colors.foreground, fontFamily: fontFamily.headline }]}>{data.ready_label}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={onTransfer}
          style={[styles.transfer, { backgroundColor: colors.sellerProfileBannerDefault }]}
        >
          <Text style={[styles.transferLabel, { color: "#FFFFFF", fontFamily: fontFamily.text }]}>Transfer Funds</Text>
        </Pressable>
      </View>
      {empty ? (
        <EarningsEmpty
          title="No available earnings"
          body="When you make a sale and the earnings are released, they will appear here."
        />
      ) : null}
      {!empty ? <EarningsLineList items={data.ready_items} /> : null}
    </View>
  )
}

function EarningsEmpty({ title, body }: { title: string; body: string }) {
  const colors = useReswellColors()
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyMark, { backgroundColor: colors.listingHeart }]}>
        <SymbolView name={{ ios: "dollarsign", android: "attach_money", web: "attach_money" }} size={28} tintColor="#FFFFFF" />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>{title}</Text>
      <Text style={[styles.emptyBody, { color: colors.muted, fontFamily: fontFamily.text }]}>{body}</Text>
    </View>
  )
}

function ActivityHistory({ items }: { items: EarningsLine[] }) {
  const colors = useReswellColors()
  const [filter, setFilter] = useState<ActivityFilter>("all")
  const visible = filter === "all" ? items : items.filter((item) => item.kind === filter)
  return (
    <View>
      <Text style={[styles.pageTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>Activity</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {ACTIVITY_FILTERS.map((option) => {
          const selected = option.id === filter
          return (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              onPress={() => setFilter(option.id)}
              style={[
                styles.filter,
                {
                  backgroundColor: selected ? colors.foreground : colors.background,
                  borderColor: selected ? colors.foreground : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterLabel,
                  { color: selected ? colors.background : colors.foreground, fontFamily: fontFamily.text },
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>
      {visible.length === 0 ? (
        <EarningsEmpty title="Nothing in this view" body="Sales, payouts, and refunds that match this filter will show up here." />
      ) : (
        <EarningsLineList items={visible} />
      )}
    </View>
  )
}

function EarningsLineList({ items }: { items: EarningsLine[] }) {
  const router = useRouter()
  if (items.length === 0) return null
  return (
    <View style={styles.activity}>
      {items.map((item) => {
        const saleId = item.sale_id
        return (
          <EarningsLineRow
            key={item.id}
            item={item}
            onPress={saleId ? () => router.push({ pathname: "/account/sales/[id]", params: { id: saleId } }) : undefined}
          />
        )
      })}
    </View>
  )
}

function EarningsLineRow({ item, onPress }: { item: EarningsLine; onPress?: () => void }) {
  const colors = useReswellColors()
  const amountColor = item.amount_usd < 0 ? colors.foreground : colors.listingHeart
  const body = (
    <>
      {item.image_url ? (
        <Image source={{ uri: item.image_url }} style={[styles.thumb, { backgroundColor: colors.image }]} contentFit="cover" />
      ) : (
        <View style={[styles.thumb, styles.thumbFallback, { backgroundColor: colors.secondary }]}>
          <SymbolView name={{ ios: "dollarsign", android: "attach_money", web: "attach_money" }} size={16} tintColor={colors.muted} />
        </View>
      )}
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, { color: colors.foreground, fontFamily: fontFamily.text }]} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={[styles.detail, { color: colors.muted, fontFamily: fontFamily.text }]}>
          {item.status_label} · {activityDate(item.created_at)}
        </Text>
      </View>
      <Text style={[styles.rowAmount, { color: amountColor, fontFamily: fontFamily.text }]}>{item.amount_label}</Text>
    </>
  )
  if (!onPress) return <View style={[styles.activityRow, { borderBottomColor: colors.border }]}>{body}</View>
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.activityRow, { borderBottomColor: colors.border }]}>
      {body}
    </Pressable>
  )
}

function activityDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loading: { fontSize: 15, paddingVertical: 12, paddingHorizontal: 16 },
  pageTitle: { fontSize: 32, fontWeight: "700", letterSpacing: -0.6, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 18 },
  link: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  linkCopy: { flex: 1, gap: 1 },
  linkTitle: { fontSize: 20, fontWeight: "700", letterSpacing: -0.3 },
  linkAmount: { fontSize: 16, fontWeight: "400" },
  rule: { height: StyleSheet.hairlineWidth },
  balanceBand: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 20, gap: 6 },
  balanceEyebrow: { fontSize: 12, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase" },
  balanceAmount: { fontSize: 40, fontWeight: "700", letterSpacing: -1, marginBottom: 8 },
  transfer: {
    minHeight: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  transferLabel: { fontSize: 17, fontWeight: "700" },
  empty: { alignItems: "center", paddingHorizontal: 36, paddingTop: 56, gap: 10 },
  emptyMark: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: { fontSize: 20, fontWeight: "700", textAlign: "center" },
  emptyBody: { fontSize: 16, lineHeight: 22, textAlign: "center" },
  activity: { marginTop: 8 },
  filters: { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  filter: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  filterLabel: { fontSize: 14, fontWeight: "600" },
  thumb: { width: 52, height: 52, borderRadius: 8 },
  thumbFallback: { alignItems: "center", justifyContent: "center" },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  detail: { fontSize: 14, lineHeight: 20 },
  rowCopy: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: "600" },
  rowAmount: { fontSize: 15, fontWeight: "700" },
})
