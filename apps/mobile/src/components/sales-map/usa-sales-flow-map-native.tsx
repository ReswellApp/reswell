import { useMemo, useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg"
import type { MobileMarketplaceSalesMap } from "@reswell/api-contract"
import { fontFamily, type ReswellColors } from "@/theme"

const BRAND_CTA_BLUE = "#5574AD"
const BRAND_DARK_BLUE = "#355185"
const BRAND_DEEP_BLUE = "#163060"
const FLOW_RED = "#dc2626"

type MapSelection =
  | { kind: "state"; state: string }
  | { kind: "flow"; sellerState: string; buyerState: string }
  | null

function mapSelectionsMatch(a: MapSelection, b: MapSelection): boolean {
  if (!a || !b) return false
  if (a.kind !== b.kind) return false
  if (a.kind === "state" && b.kind === "state") return a.state === b.state
  if (a.kind === "flow" && b.kind === "flow") {
    return a.sellerState === b.sellerState && a.buyerState === b.buyerState
  }
  return false
}

function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount)
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "")
  const r = Number.parseInt(normalized.slice(0, 2), 16)
  const g = Number.parseInt(normalized.slice(2, 4), 16)
  const b = Number.parseInt(normalized.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function stateNameFor(data: MobileMarketplaceSalesMap, code: string): string {
  return data.stateStats.find((row) => row.state === code)?.stateName ?? code
}

type UsaSalesFlowMapProps = {
  data: MobileMarketplaceSalesMap
  colors: ReswellColors
}

export function UsaSalesFlowMapNative({ data, colors }: UsaSalesFlowMapProps) {
  const [selection, setSelection] = useState<MapSelection>(null)
  const { geometry } = data

  function toggleSelection(next: Exclude<MapSelection, null>) {
    setSelection((current) => (mapSelectionsMatch(current, next) ? null : next))
  }

  const stateStatsByCode = useMemo(() => {
    return new Map(data.stateStats.map((row) => [row.state, row]))
  }, [data.stateStats])

  const maxStateActivity = useMemo(() => {
    return Math.max(1, ...data.stateStats.map((row) => row.asSeller + row.asBuyer))
  }, [data.stateStats])

  const selectionLabel = useMemo(() => {
    if (!selection) return null
    if (selection.kind === "state") {
      const stat = stateStatsByCode.get(selection.state)
      const registeredUsers = data.userCountsByState[selection.state] ?? 0
      const lines: string[] = []

      if (registeredUsers > 0) {
        lines.push(
          `${registeredUsers.toLocaleString()} surfer${registeredUsers === 1 ? "" : "s"} from this state using Reswell`,
        )
      }

      if (stat) {
        lines.push(
          `${stat.asSeller} sold from here`,
          `${stat.asBuyer} bought here`,
          `${formatUsd(stat.volumeUsd)} volume`,
        )
      } else if (registeredUsers === 0) {
        lines.push("No mapped sales or signed-up surfers in this state yet.")
      }

      return {
        title: stat?.stateName ?? stateNameFor(data, selection.state),
        lines,
      }
    }

    const flow = data.flows.find(
      (row) =>
        row.sellerState === selection.sellerState && row.buyerState === selection.buyerState,
    )
    if (!flow) return null
    return {
      title: `${stateNameFor(data, flow.sellerState)} → ${stateNameFor(data, flow.buyerState)}`,
      lines: [
        `${flow.count} order${flow.count === 1 ? "" : "s"}`,
        `${formatUsd(flow.volumeUsd)} volume`,
      ],
    }
  }, [selection, stateStatsByCode, data])

  return (
    <View style={[styles.wrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <View style={styles.mapFrame}>
        <Svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${geometry.width} ${geometry.height}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <Defs>
            <LinearGradient id="sales-map-surface" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={colors.background} />
              <Stop offset="100%" stopColor={colors.secondary} />
            </LinearGradient>
          </Defs>

          <Rect
            width={geometry.width}
            height={geometry.height}
            fill="url(#sales-map-surface)"
            onPress={() => setSelection(null)}
          />

          {geometry.statePaths.map((state) => {
            const stat = stateStatsByCode.get(state.code)
            const activity = stat ? stat.asSeller + stat.asBuyer : 0
            const intensity = activity / maxStateActivity
            const hasShippingActivity = Boolean(stat && (stat.asSeller > 0 || stat.asBuyer > 0))
            const fill = hasShippingActivity
              ? hexToRgba(BRAND_CTA_BLUE, 0.2 + intensity * 0.55)
              : "rgba(148, 163, 184, 0.08)"
            const isSelected = selection?.kind === "state" && selection.state === state.code

            return (
              <Path
                key={state.code}
                d={state.d}
                fill={fill}
                stroke={
                  isSelected
                    ? BRAND_DEEP_BLUE
                    : hasShippingActivity
                      ? hexToRgba(BRAND_DARK_BLUE, 0.55)
                      : "rgba(148, 163, 184, 0.45)"
                }
                strokeWidth={isSelected ? 1.4 : 0.7}
                onPress={() => toggleSelection({ kind: "state", state: state.code })}
              />
            )
          })}

          {geometry.flowPaths.map((flow) => {
            const isSelected =
              selection?.kind === "flow" &&
              selection.sellerState === flow.sellerState &&
              selection.buyerState === flow.buyerState

            return (
              <Path
                key={`${flow.sellerState}-${flow.buyerState}`}
                d={flow.d}
                fill="none"
                stroke={FLOW_RED}
                strokeWidth={isSelected ? flow.width + 1.2 : flow.width}
                strokeOpacity={isSelected ? 0.95 : flow.opacity}
                onPress={() =>
                  toggleSelection({
                    kind: "flow",
                    sellerState: flow.sellerState,
                    buyerState: flow.buyerState,
                  })
                }
              />
            )
          })}

          {geometry.stateDots.map((dot) => {
            const isSelected = selection?.kind === "state" && selection.state === dot.code
            return (
              <Circle
                key={`dot-${dot.code}`}
                cx={dot.cx}
                cy={dot.cy}
                r={isSelected ? dot.radius + 1.5 : dot.radius}
                fill={dot.fill}
                fillOpacity={isSelected ? 0.95 : 0.72}
                stroke="white"
                strokeWidth={1.2}
              />
            )
          })}
        </Svg>
      </View>

      {selectionLabel ? (
        <View style={[styles.selectionBar, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
          <View style={styles.selectionCopy}>
            <Text style={[styles.selectionTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
              {selectionLabel.title}
            </Text>
            {selectionLabel.lines.map((line) => (
              <Text key={line} style={[styles.selectionLine, { color: colors.muted, fontFamily: fontFamily.text }]}>
                {line}
              </Text>
            ))}
          </View>
          <Pressable onPress={() => setSelection(null)} hitSlop={8}>
            <Text style={[styles.close, { color: colors.muted, fontFamily: fontFamily.text }]}>Close</Text>
          </Pressable>
        </View>
      ) : (
        <View style={[styles.legend, { borderTopColor: colors.border }]}>
          <Text style={[styles.legendHint, { color: colors.foreground, fontFamily: fontFamily.text }]}>
            Tap a state for stats
          </Text>
          <View style={styles.legendRow}>
            <View style={[styles.flowSwatch, { backgroundColor: `${FLOW_RED}B3` }]} />
            <Text style={[styles.legendLabel, { color: colors.muted, fontFamily: fontFamily.text }]}>Flow</Text>
            <View style={[styles.stateSwatch, { backgroundColor: BRAND_CTA_BLUE }]} />
            <Text style={[styles.legendLabel, { color: colors.muted, fontFamily: fontFamily.text }]}>
              Active states
            </Text>
          </View>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    overflow: "hidden",
  },
  mapFrame: {
    width: "100%",
    aspectRatio: 960 / 600,
    minHeight: 220,
  },
  selectionBar: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  selectionCopy: { flex: 1, gap: 2 },
  selectionTitle: { fontSize: 15, lineHeight: 20 },
  selectionLine: { fontSize: 12, lineHeight: 17 },
  close: { fontSize: 13, fontWeight: "600" },
  legend: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
  },
  legendHint: { fontSize: 12, fontWeight: "600" },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  flowSwatch: { width: 18, height: 8, borderRadius: 999 },
  stateSwatch: { width: 10, height: 10, borderRadius: 999 },
  legendLabel: { fontSize: 11, marginRight: 8 },
})
