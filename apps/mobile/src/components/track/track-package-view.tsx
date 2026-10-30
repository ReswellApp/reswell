import { Image } from "expo-image"
import { useRouter } from "expo-router"
import { SymbolView } from "expo-symbols"
import { useState } from "react"
import { Pressable, Share, StyleSheet, Text, View } from "react-native"
import type { MobilePurchaseStatusTone, MobileTrackEvent, MobileTrackPackage } from "@reswell/api-contract"
import { formatCompactDateTime, formatPurchaseDate, formatPurchaseDateTime } from "@/lib/purchase-display"
import { trackMapHref } from "@/lib/track-package"
import { fontFamily, useReswellColors } from "@/theme"

const STATUS_BANNER: Record<MobilePurchaseStatusTone, { backgroundColor: string; color: string }> = {
  success: { backgroundColor: "#F0FDF4", color: "#14532D" },
  warning: { backgroundColor: "#FFFBEB", color: "#451A03" },
  danger: { backgroundColor: "#FFF1F2", color: "#881337" },
  neutral: { backgroundColor: "#F8FAFC", color: "#1E293B" },
}

const ACTIVITY_PREVIEW = 3

function Timeline({ events }: { events: MobileTrackEvent[] }) {
  const colors = useReswellColors()
  const [expanded, setExpanded] = useState(false)
  const hiddenCount = Math.max(0, events.length - ACTIVITY_PREVIEW)
  const visible = expanded ? events : events.slice(0, ACTIVITY_PREVIEW)

  return (
    <View>
      {visible.map((event, index) => {
        const isLast = index === visible.length - 1
        const meta = [event.location, event.occurred_at ? formatCompactDateTime(event.occurred_at) : null]
          .filter(Boolean)
          .join(" · ")
        return (
          <View
            key={`${event.occurred_at ?? "event"}-${index}`}
            style={[styles.timelineRow, isLast && styles.timelineRowLast]}
          >
            {!isLast ? <View style={[styles.timelineLine, { backgroundColor: colors.border }]} /> : null}
            <View
              style={[
                styles.dot,
                {
                  borderColor: index === 0 ? colors.foreground : colors.muted,
                  backgroundColor: index === 0 ? colors.foreground : colors.background,
                },
              ]}
            />
            <View style={styles.timelineCopy}>
              <Text
                style={[
                  styles.timelineTitle,
                  { color: colors.foreground, fontFamily: fontFamily.text, fontWeight: index === 0 ? "700" : "500" },
                ]}
              >
                {event.description}
              </Text>
              {meta ? (
                <Text style={[styles.timelineDate, { color: colors.muted, fontFamily: fontFamily.text }]}>{meta}</Text>
              ) : null}
            </View>
          </View>
        )
      })}
      {hiddenCount > 0 ? (
        <Pressable onPress={() => setExpanded((current) => !current)} style={styles.moreScans}>
          <Text style={[styles.refreshLabel, { color: colors.muted, fontFamily: fontFamily.text }]}>
            {expanded ? "Show less" : `Show ${hiddenCount} earlier ${hiddenCount === 1 ? "scan" : "scans"}`}
          </Text>
        </Pressable>
      ) : null}
    </View>
  )
}

function MetaCard({ label, value }: { label: string; value: string }) {
  const colors = useReswellColors()
  return (
    <View style={[styles.metaCard, { borderColor: colors.border }]}>
      <Text style={[styles.kicker, { color: colors.muted, fontFamily: fontFamily.text }]}>{label}</Text>
      <Text style={[styles.metaValue, { color: colors.foreground, fontFamily: fontFamily.text }]}>{value}</Text>
    </View>
  )
}

export function TrackPackageView({
  page,
  refreshing,
  refreshError,
  onRefresh,
}: {
  page: MobileTrackPackage
  refreshing: boolean
  refreshError: string | null
  onRefresh: () => void
}) {
  const colors = useReswellColors()
  const router = useRouter()
  const banner = STATUS_BANNER[page.status_tone]
  const card = { backgroundColor: colors.secondary }
  const [copied, setCopied] = useState(false)
  const [mapFailed, setMapFailed] = useState(false)

  return (
    <View style={styles.page}>
      <Text style={[styles.kicker, { color: colors.muted, fontFamily: fontFamily.text }]}>
        ORDER #{page.order_number}
      </Text>
      <Text style={[styles.heading, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
        Track your package
      </Text>
      <Text style={[styles.subtitle, { color: colors.muted, fontFamily: fontFamily.text }]}>{page.listing_title}</Text>

      <View style={[styles.card, card]}>
        <View style={styles.headerRow}>
          <View style={[styles.iconWrap, { backgroundColor: colors.primary }]}>
            <SymbolView
              name={{ ios: "truck.box", android: "local_shipping", web: "local_shipping" }}
              size={18}
              tintColor={colors.primaryForeground}
            />
          </View>
          <View style={styles.headerCopy}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
              Reswell tracking
            </Text>
            <Text style={[styles.subtitle, { color: colors.muted, fontFamily: fontFamily.text }]}>
              Live carrier scans for this shipment.
            </Text>
          </View>
        </View>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { borderColor: colors.border }]}>
            <Text style={[styles.badgeLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>
              {page.carrier_label}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: banner.backgroundColor, borderColor: banner.backgroundColor }]}>
            <Text style={[styles.badgeLabel, { color: banner.color, fontFamily: fontFamily.text }]}>
              {page.status_label}
            </Text>
          </View>
        </View>
      </View>

      <View style={[styles.card, card]}>
        <Text style={[styles.kicker, { color: colors.muted, fontFamily: fontFamily.text }]}>TRACKING NUMBER</Text>
        <Pressable
          onPress={() => {
            void Share.share({ message: page.tracking_number }).then(() => {
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            })
          }}
          accessibilityRole="button"
          accessibilityLabel={copied ? "Tracking number copied" : "Share or copy tracking number"}
          style={styles.trackingRow}
        >
          <Text selectable style={[styles.trackingNumber, { color: colors.foreground, fontFamily: fontFamily.text }]}>
            {page.tracking_number}
          </Text>
          <SymbolView
            name={{
              ios: copied ? "checkmark" : "doc.on.doc",
              android: copied ? "check" : "content_copy",
              web: "content_copy",
            }}
            size={16}
            tintColor={colors.muted}
          />
        </Pressable>
      </View>

      <View style={[styles.statusCard, { backgroundColor: banner.backgroundColor }]}>
        <Text style={[styles.statusLabel, { color: banner.color, fontFamily: fontFamily.headline }]}>
          {page.status_label}
        </Text>
        {page.status_description ? (
          <Text style={[styles.statusBody, { color: banner.color, fontFamily: fontFamily.text }]}>
            {page.status_description}
          </Text>
        ) : null}
      </View>

      {page.exception_description ? (
        <View style={[styles.statusCard, { backgroundColor: STATUS_BANNER.warning.backgroundColor }]}>
          <Text style={[styles.statusBody, { color: STATUS_BANNER.warning.color, fontFamily: fontFamily.text }]}>
            {page.exception_description}
          </Text>
        </View>
      ) : null}

      <View style={styles.metaGrid}>
        {page.estimated_delivery_at ? (
          <MetaCard label="EST. DELIVERY" value={formatPurchaseDate(page.estimated_delivery_at, "long")} />
        ) : null}
        {page.delivered_at ? (
          <MetaCard label="CARRIER DELIVERED" value={formatPurchaseDateTime(page.delivered_at)} />
        ) : null}
        {page.updated_at ? (
          <MetaCard label="LAST REFRESHED" value={formatPurchaseDateTime(page.updated_at)} />
        ) : null}
      </View>

      <View style={styles.activityHeader}>
        <View style={styles.activityCopy}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
            Shipment activity
          </Text>
          {page.map?.summary ? (
            <Text style={[styles.timelineDate, { color: colors.muted, fontFamily: fontFamily.text }]}>
              {page.map.summary}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={onRefresh}
          disabled={refreshing}
          accessibilityRole="button"
          accessibilityLabel="Refresh tracking"
          style={styles.refresh}
        >
          <SymbolView
            name={{ ios: "arrow.clockwise", android: "refresh", web: "refresh" }}
            size={14}
            tintColor={colors.muted}
          />
          <Text style={[styles.refreshLabel, { color: colors.muted, fontFamily: fontFamily.text }]}>
            {refreshing ? "Refreshing" : "Refresh"}
          </Text>
        </Pressable>
      </View>

      {refreshError ? (
        <Text style={[styles.refreshError, { color: colors.muted, fontFamily: fontFamily.text }]}>
          Showing last saved update. {refreshError}
        </Text>
      ) : null}

      {page.events.length > 0 ? (
        <View style={[styles.card, card]}>
          {page.map?.image_url && !mapFailed ? (
            <Pressable
              onPress={() => {
                const href = trackMapHref(page.order_id)
                if (href) router.push(href)
              }}
              accessibilityRole="button"
              accessibilityLabel="Open shipment map"
            >
              <Image
                source={{ uri: page.map.image_url }}
                style={[styles.map, { backgroundColor: colors.image }]}
                contentFit="cover"
                onError={() => setMapFailed(true)}
              />
            </Pressable>
          ) : null}
          <Timeline events={page.events} />
        </View>
      ) : (
        <Text style={[styles.subtitle, { color: colors.muted, fontFamily: fontFamily.text }]}>
          No scan events yet. The carrier may not have posted updates — check back shortly.
        </Text>
      )}

      {page.live ? (
        <Text style={[styles.liveHint, { color: colors.muted, fontFamily: fontFamily.text }]}>
          Updates automatically every few minutes while in transit.
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32, gap: 16 },
  kicker: { fontSize: 11, fontWeight: "700", letterSpacing: 0.6 },
  heading: { fontSize: 26, fontWeight: "700", letterSpacing: -0.4 },
  subtitle: { fontSize: 15, lineHeight: 20 },
  card: { borderRadius: 14, borderCurve: "continuous", padding: 16, gap: 12 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  iconWrap: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1, minWidth: 0, gap: 2 },
  sectionTitle: { fontSize: 16, fontWeight: "700" },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  badge: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  badgeLabel: { fontSize: 12, fontWeight: "700" },
  trackingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  trackingNumber: { flex: 1, fontSize: 16, fontWeight: "600", fontVariant: ["tabular-nums"] },
  statusCard: { borderRadius: 14, borderCurve: "continuous", padding: 16, gap: 6 },
  statusLabel: { fontSize: 18, fontWeight: "700" },
  statusBody: { fontSize: 14, lineHeight: 20 },
  metaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metaCard: { flexGrow: 1, flexBasis: 140, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12, gap: 6 },
  metaValue: { fontSize: 14, fontWeight: "600" },
  activityHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  activityCopy: { flex: 1, minWidth: 0, gap: 2 },
  map: { width: "100%", height: 160, borderRadius: 12, borderCurve: "continuous", marginBottom: 4 },
  moreScans: { paddingTop: 8 },
  refresh: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 },
  refreshLabel: { fontSize: 13, fontWeight: "600" },
  refreshError: { fontSize: 13, lineHeight: 18 },
  timelineRow: { position: "relative", flexDirection: "row", gap: 10, paddingBottom: 10 },
  timelineRowLast: { paddingBottom: 0 },
  timelineLine: { position: "absolute", left: 5, top: 12, width: StyleSheet.hairlineWidth + 1, bottom: 0 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, marginTop: 2 },
  timelineCopy: { flex: 1, minWidth: 0 },
  timelineTitle: { fontSize: 14, lineHeight: 18 },
  timelineDate: { fontSize: 11, marginTop: 2, lineHeight: 15 },
  liveHint: { fontSize: 12, lineHeight: 16 },
})
