import { useMemo, useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import type { MobileMarketplaceSalesMap } from "@reswell/api-contract"
import { fontFamily, type ReswellColors } from "@/theme"

function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount)
}

type Props = {
  data: MobileMarketplaceSalesMap
  colors: ReswellColors
}

export function UsaSalesFlowMapFallback({ data, colors }: Props) {
  const [expandedState, setExpandedState] = useState<string | null>(null)

  const topStates = useMemo(() => {
    return [...data.stateStats]
      .filter((row) => row.asSeller > 0 || row.asBuyer > 0)
      .sort((a, b) => b.asSeller + b.asBuyer - (a.asSeller + a.asBuyer))
      .slice(0, 12)
  }, [data.stateStats])

  const topFlows = useMemo(() => {
    return [...data.flows].sort((a, b) => b.count - a.count).slice(0, 8)
  }, [data.flows])

  return (
    <View style={[styles.wrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <View style={[styles.banner, { backgroundColor: colors.secondary }]}>
        <Text style={[styles.bannerTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
          Map preview
        </Text>
        <Text style={[styles.bannerBody, { color: colors.muted, fontFamily: fontFamily.text }]}>
          Install the latest dev build to see the interactive U.S. map. Routes and state activity are listed below
          from the same API data.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.sellerProfileBannerDefault, fontFamily: fontFamily.text }]}>
          BUSIEST STATES
        </Text>
        {topStates.map((row) => {
          const open = expandedState === row.state
          return (
            <Pressable
              key={row.state}
              onPress={() => setExpandedState(open ? null : row.state)}
              style={[styles.row, { borderColor: colors.border }]}
            >
              <Text style={[styles.rowTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
                {row.stateName}
              </Text>
              <Text style={[styles.rowMeta, { color: colors.muted, fontFamily: fontFamily.text }]}>
                {row.asSeller} sold · {row.asBuyer} bought · {formatUsd(row.volumeUsd)}
              </Text>
              {open ? (
                <Text style={[styles.rowExtra, { color: colors.muted, fontFamily: fontFamily.text }]}>
                  {(data.userCountsByState[row.state] ?? 0).toLocaleString()} surfers signed up in this state
                </Text>
              ) : null}
            </Pressable>
          )
        })}
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.sellerProfileBannerDefault, fontFamily: fontFamily.text }]}>
          TOP ROUTES
        </Text>
        {topFlows.map((flow) => {
          const from = data.stateStats.find((s) => s.state === flow.sellerState)?.stateName ?? flow.sellerState
          const to = data.stateStats.find((s) => s.state === flow.buyerState)?.stateName ?? flow.buyerState
          return (
            <View key={`${flow.sellerState}-${flow.buyerState}`} style={[styles.row, { borderColor: colors.border }]}>
              <Text style={[styles.rowTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
                {from} → {to}
              </Text>
              <Text style={[styles.rowMeta, { color: colors.muted, fontFamily: fontFamily.text }]}>
                {flow.count} orders · {formatUsd(flow.volumeUsd)}
              </Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    overflow: "hidden",
  },
  banner: { paddingHorizontal: 14, paddingVertical: 12, gap: 4 },
  bannerTitle: { fontSize: 15, fontWeight: "600" },
  bannerBody: { fontSize: 13, lineHeight: 18 },
  section: { paddingHorizontal: 14, paddingBottom: 12, gap: 6 },
  sectionLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 1, marginTop: 4 },
  row: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    gap: 2,
  },
  rowTitle: { fontSize: 15, lineHeight: 20 },
  rowMeta: { fontSize: 12, lineHeight: 17 },
  rowExtra: { fontSize: 12, lineHeight: 17, marginTop: 2 },
})
