import { Image } from "expo-image"
import { Stack, useRouter } from "expo-router"
import { useCallback, useEffect, useState } from "react"
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native"
import type { MobileMarketplaceSalesMap } from "@reswell/api-contract"
import { UsaSalesFlowMap } from "@/components/sales-map/usa-sales-flow-map"
import { SCREEN_GUTTER, ScreenScroll, ScreenShell } from "@/components/screen-shell"
import { fetchMarketplaceSalesMap } from "@/lib/api"
import { fontFamily, useReswellColors } from "@/theme"

function formatGmv(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime()
  const diffMs = Date.now() - then
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function SalesMapScreen() {
  const colors = useReswellColors()
  const router = useRouter()
  const [data, setData] = useState<MobileMarketplaceSalesMap | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const reload = useCallback(() => setAttempt((value) => value + 1), [])

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError(null)
    fetchMarketplaceSalesMap()
      .then((payload) => {
        if (!cancelled) setData(payload)
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Unable to load the sales map")
        }
      })
    return () => {
      cancelled = true
    }
  }, [attempt])

  return (
    <ScreenShell style={{ backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: "Sales Map", headerShown: true }} />
      {!data && !error ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.foreground} />
        </View>
      ) : null}
      {error ? (
        <View style={styles.center}>
          <Text style={[styles.body, { color: colors.muted, fontFamily: fontFamily.text }]}>{error}</Text>
          <Pressable onPress={reload}>
            <Text style={[styles.retry, { color: colors.foreground, fontFamily: fontFamily.text }]}>Try again</Text>
          </Pressable>
        </View>
      ) : null}
      {data ? (
        <ScreenScroll contentContainerStyle={styles.page}>
          <Text style={[styles.kicker, { color: colors.sellerProfileBannerDefault, fontFamily: fontFamily.text }]}>
            SELLER RESOURCES
          </Text>
          <Text style={[styles.title, { color: colors.sold, fontFamily: fontFamily.headline }]}>
            Where Reswell orders flow
          </Text>
          <Text style={[styles.lead, { color: colors.muted, fontFamily: fontFamily.text }]}>
            Confirmed sales mapped from seller state to buyer state.
          </Text>

          <View style={styles.statsGrid}>
            <StatTile
              colors={colors}
              label="Mapped sales"
              value={data.totals.mappableSales.toLocaleString()}
              hint={`${data.totals.confirmedSales.toLocaleString()} confirmed`}
            />
            <StatTile
              colors={colors}
              label="States selling"
              value={data.totals.statesSelling.toLocaleString()}
              hint="Listing origins"
            />
            <StatTile
              colors={colors}
              label="Cross-state"
              value={data.totals.crossStateSales.toLocaleString()}
              hint={`${data.totals.statesBuying} buyer states`}
            />
            <StatTile
              colors={colors}
              label="Volume"
              value={formatGmv(data.totals.volumeUsd)}
              hint="Confirmed gross"
            />
          </View>

          <UsaSalesFlowMap data={data} colors={colors} />

          {data.truncated ? (
            <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>
              Showing the most recent {data.totals.confirmedSales.toLocaleString()} confirmed sales.
            </Text>
          ) : null}
          <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>
            Updated {formatRelative(data.generatedAt)} · New sales added after checkout
          </Text>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.sellerProfileBannerDefault, fontFamily: fontFamily.text }]}>
              TOP 10 SELLERS
            </Text>
            {data.topSellers.length === 0 ? (
              <Text style={[styles.body, { color: colors.muted, fontFamily: fontFamily.text }]}>
                No public sellers to rank yet.
              </Text>
            ) : (
              data.topSellers.map((seller, index) => (
                <Pressable
                  key={seller.id}
                  onPress={() => {
                    const slug = seller.href.replace(/^\/sellers\//, "").replace(/^\//, "")
                    if (slug) router.push({ pathname: "/sellers/[slug]", params: { slug } })
                  }}
                  style={[styles.sellerRow, { borderColor: colors.border }]}
                >
                  <Text style={[styles.rank, { color: colors.muted, fontFamily: fontFamily.text }]}>{index + 1}</Text>
                  <View style={[styles.avatar, { backgroundColor: colors.secondary }]}>
                    {seller.imageSrc ? (
                      <Image source={{ uri: seller.imageSrc }} style={styles.avatarImage} contentFit="cover" />
                    ) : (
                      <Text style={[styles.avatarFallback, { color: colors.sold, fontFamily: fontFamily.headline }]}>
                        {seller.name.charAt(0).toUpperCase()}
                      </Text>
                    )}
                  </View>
                  <View style={styles.sellerCopy}>
                    <Text
                      numberOfLines={1}
                      style={[styles.sellerName, { color: colors.foreground, fontFamily: fontFamily.headline }]}
                    >
                      {seller.name}
                      {seller.shopVerified ? " ✓" : ""}
                    </Text>
                    <Text style={[styles.sellerMeta, { color: colors.muted, fontFamily: fontFamily.text }]}>
                      {seller.salesCount === 1 ? "1 sold" : `${seller.salesCount.toLocaleString()} sold`}
                    </Text>
                  </View>
                </Pressable>
              ))
            )}
          </View>
        </ScreenScroll>
      ) : null}
    </ScreenShell>
  )
}

function StatTile({
  colors,
  label,
  value,
  hint,
}: {
  colors: ReturnType<typeof useReswellColors>
  label: string
  value: string
  hint: string
}) {
  return (
    <View style={[styles.statTile, { backgroundColor: colors.secondary }]}>
      <Text style={[styles.statLabel, { color: colors.sellerProfileBannerDefault, fontFamily: fontFamily.text }]}>
        {label.toUpperCase()}
      </Text>
      <Text style={[styles.statValue, { color: colors.sold, fontFamily: fontFamily.headline }]}>{value}</Text>
      <Text numberOfLines={1} style={[styles.statHint, { color: colors.muted, fontFamily: fontFamily.text }]}>
        {hint}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  page: { paddingHorizontal: SCREEN_GUTTER, paddingTop: 12, paddingBottom: 48, gap: 16 },
  kicker: { fontSize: 11, fontWeight: "700", letterSpacing: 1.4 },
  title: { fontSize: 28, lineHeight: 32, fontWeight: "700" },
  lead: { fontSize: 16, lineHeight: 24 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statTile: {
    width: "48%",
    flexGrow: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 2,
  },
  statLabel: { fontSize: 10, fontWeight: "600", letterSpacing: 0.6 },
  statValue: { fontSize: 22, lineHeight: 26, fontWeight: "700" },
  statHint: { fontSize: 11, lineHeight: 15 },
  meta: { fontSize: 12, lineHeight: 17, textAlign: "center" },
  section: { gap: 8, marginTop: 4 },
  sectionTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2 },
  body: { fontSize: 15, lineHeight: 22 },
  sellerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
  },
  rank: { width: 18, textAlign: "center", fontSize: 12, fontWeight: "600" },
  avatar: { width: 36, height: 36, borderRadius: 18, overflow: "hidden" },
  avatarImage: { width: "100%", height: "100%" },
  avatarFallback: { flex: 1, textAlign: "center", lineHeight: 36, fontSize: 14, fontWeight: "700" },
  sellerCopy: { flex: 1, minWidth: 0, gap: 2 },
  sellerName: { fontSize: 15, lineHeight: 20, fontWeight: "600" },
  sellerMeta: { fontSize: 12 },
  retry: { fontSize: 15, fontWeight: "600" },
})
