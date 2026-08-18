"use client"

import { useMemo, useState, useSyncExternalStore } from "react"
import { formatDistanceToNow, parseISO } from "date-fns"
import { ArrowRight, MapPin, Package, TrendingUp } from "lucide-react"
import type { MarketplaceSalesMapPayload } from "@/lib/types/marketplace-sales-map"
import { BRAND_CTA_BLUE, BRAND_DARK_BLUE, BRAND_DEEP_BLUE } from "@/lib/brand-colors"
import { formatGmv } from "@/lib/format-gmv"
import { cn } from "@/lib/utils"
import { usStateDisplayName } from "@/lib/utils/us-state-names"

type MapSelection =
  | { kind: "state"; state: string }
  | { kind: "flow"; sellerState: string; buyerState: string }
  | null

const MOBILE_MAP_QUERY = "(max-width: 639px)"

function subscribeMobileMap(onStoreChange: () => void) {
  const mql = window.matchMedia(MOBILE_MAP_QUERY)
  mql.addEventListener("change", onStoreChange)
  return () => mql.removeEventListener("change", onStoreChange)
}

function getMobileMapSnapshot() {
  return window.matchMedia(MOBILE_MAP_QUERY).matches
}

function getMobileMapServerSnapshot() {
  return false
}

function useMobileMapView() {
  return useSyncExternalStore(subscribeMobileMap, getMobileMapSnapshot, getMobileMapServerSnapshot)
}

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

type UsaSalesFlowMapProps = {
  data: MarketplaceSalesMapPayload
  className?: string
  /** Compact height for directory embeds; default matches `/map`. */
  size?: "default" | "compact"
}

export function UsaSalesFlowMap({
  data,
  className,
  size = "default",
}: UsaSalesFlowMapProps) {
  const isCompact = size === "compact"
  const svgIdPrefix = isCompact ? "cities-map" : "sales-map"
  const isMobileView = useMobileMapView()
  const [selection, setSelection] = useState<MapSelection>(null)
  const { geometry } = data

  function toggleSelection(next: Exclude<MapSelection, null>) {
    setSelection((current) => (mapSelectionsMatch(current, next) ? null : next))
  }

  const stateStatsByCode = useMemo(() => {
    return new Map(data.stateStats.map((row) => [row.state, row]))
  }, [data.stateStats])

  const maxStateActivity = useMemo(() => {
    return Math.max(
      1,
      ...data.stateStats.map((row) => row.asSeller + row.asBuyer),
    )
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
        title: stat?.stateName ?? usStateDisplayName(selection.state),
        lines,
      }
    }

    const flow = data.flows.find(
      (row) =>
        row.sellerState === selection.sellerState && row.buyerState === selection.buyerState,
    )
    if (!flow) return null
    return {
      title: `${usStateDisplayName(flow.sellerState)} → ${usStateDisplayName(flow.buyerState)}`,
      lines: [
        `${flow.count} order${flow.count === 1 ? "" : "s"}`,
        `${formatUsd(flow.volumeUsd)} volume`,
      ],
    }
  }, [selection, stateStatsByCode, data.flows, data.userCountsByState])

  return (
    <div className={cn("relative", className)}>
      <div className="overflow-hidden rounded-xl border border-border/80 bg-gradient-to-b from-muted/30 via-background to-background shadow-sm sm:rounded-2xl">
        <div
          className={cn(
            "relative w-full",
            isCompact
              ? "h-[220px] sm:h-[260px] md:h-[280px]"
              : "h-[480px] sm:h-[520px] md:h-[560px] lg:h-[600px]",
          )}
        >
          <svg
            viewBox={`0 0 ${geometry.width} ${geometry.height}`}
            className={cn("h-full w-full", isMobileView && "touch-manipulation")}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label="United States map showing Reswell sales flowing from seller states to buyer states"
          >
            <defs>
              <linearGradient id={`${svgIdPrefix}-surface`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="hsl(var(--background))" />
                <stop offset="100%" stopColor="hsl(var(--muted) / 0.35)" />
              </linearGradient>
              <marker
                id={`${svgIdPrefix}-flow-arrow`}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#dc2626" />
              </marker>
            </defs>

            <rect
              width={geometry.width}
              height={geometry.height}
              fill={`url(#${svgIdPrefix}-surface)`}
              onClick={() => {
                if (isMobileView) setSelection(null)
              }}
            />

            {geometry.statePaths.map((state) => {
              const stat = stateStatsByCode.get(state.code)
              const activity = stat ? stat.asSeller + stat.asBuyer : 0
              const intensity = activity / maxStateActivity
              const hasShippingActivity = Boolean(stat && (stat.asSeller > 0 || stat.asBuyer > 0))
              const fill = hasShippingActivity
                ? hexToRgba(BRAND_CTA_BLUE, 0.2 + intensity * 0.55)
                : "rgba(148, 163, 184, 0.08)"
              const isSelected =
                selection?.kind === "state" && selection.state === state.code

              return (
                <path
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
                  className={cn(
                    "transition-[fill,stroke,stroke-width] duration-200",
                    isMobileView && "cursor-pointer",
                  )}
                  aria-label={state.name}
                  onMouseEnter={() => {
                    if (!isMobileView) {
                      setSelection({ kind: "state", state: state.code })
                    }
                  }}
                  onMouseLeave={() => {
                    if (!isMobileView) setSelection(null)
                  }}
                  onClick={(event) => {
                    if (!isMobileView) return
                    event.stopPropagation()
                    toggleSelection({ kind: "state", state: state.code })
                  }}
                />
              )
            })}

            {geometry.flowPaths.map((flow) => {
              const isSelected =
                selection?.kind === "flow" &&
                selection.sellerState === flow.sellerState &&
                selection.buyerState === flow.buyerState

              return (
                <path
                  key={`${flow.sellerState}-${flow.buyerState}`}
                  d={flow.d}
                  fill="none"
                  stroke="#dc2626"
                  strokeWidth={isSelected ? flow.width + 1.2 : flow.width}
                  strokeOpacity={isSelected ? 0.95 : flow.opacity}
                  markerEnd={`url(#${svgIdPrefix}-flow-arrow)`}
                  className={cn(
                    "transition-[stroke-width,stroke-opacity] duration-200",
                    isMobileView && "cursor-pointer",
                  )}
                  onMouseEnter={() => {
                    if (!isMobileView) {
                      setSelection({
                        kind: "flow",
                        sellerState: flow.sellerState,
                        buyerState: flow.buyerState,
                      })
                    }
                  }}
                  onMouseLeave={() => {
                    if (!isMobileView) setSelection(null)
                  }}
                  onClick={(event) => {
                    if (!isMobileView) return
                    event.stopPropagation()
                    toggleSelection({
                      kind: "flow",
                      sellerState: flow.sellerState,
                      buyerState: flow.buyerState,
                    })
                  }}
                />
              )
            })}

            {geometry.stateDots.map((dot) => {
              const isSelected = selection?.kind === "state" && selection.state === dot.code

              return (
                <circle
                  key={`dot-${dot.code}`}
                  cx={dot.cx}
                  cy={dot.cy}
                  r={isSelected ? dot.radius + 1.5 : dot.radius}
                  fill={dot.fill}
                  fillOpacity={isSelected ? 0.95 : 0.72}
                  stroke="white"
                  strokeWidth={1.2}
                  className="pointer-events-none"
                />
              )
            })}
          </svg>

          {selectionLabel && !isMobileView ? (
            <div className="pointer-events-none absolute left-2 top-2 max-w-[11rem] rounded-lg border border-border/80 bg-background/95 px-2.5 py-2 shadow-lg backdrop-blur-sm sm:left-3 sm:top-3 sm:max-w-xs sm:rounded-xl sm:px-3 sm:py-2.5">
              <p className="text-xs font-semibold text-foreground sm:text-sm">
                {selectionLabel.title}
              </p>
              <ul className="mt-0.5 space-y-0.5 text-[10px] text-muted-foreground sm:text-xs">
                {selectionLabel.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {!isCompact ? (
            <div className="pointer-events-none absolute bottom-2 left-2 right-2 rounded-lg border border-border/70 bg-background/90 px-2 py-1.5 shadow-sm backdrop-blur-sm sm:bottom-3 sm:left-3 sm:right-auto sm:rounded-xl sm:px-2.5 sm:py-2">
              <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-[10px] text-muted-foreground sm:justify-start sm:gap-x-3 sm:text-xs">
                {isMobileView && !selection ? (
                  <span className="w-full text-center font-medium text-foreground/80 sm:w-auto">
                    Tap a state for stats
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-4 rounded-full bg-[#dc2626]/70 sm:h-2.5 sm:w-6" />
                  Flow
                </span>
                <span className="inline-flex items-center gap-1">
                  <span
                    className="h-2 w-2 rounded-full sm:h-2.5 sm:w-2.5"
                    style={{ backgroundColor: BRAND_CTA_BLUE }}
                  />
                  Active states
                </span>
              </div>
            </div>
          ) : null}
        </div>

        {selectionLabel && isMobileView ? (
          <div className="border-t border-border/80 bg-background px-3 py-3 sm:hidden">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{selectionLabel.title}</p>
                <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                  {selectionLabel.lines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                onClick={() => setSelection(null)}
              >
                Close
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

type SalesMapPageClientProps = {
  data: MarketplaceSalesMapPayload
}

export function SalesMapPageClient({ data }: SalesMapPageClientProps) {
  return (
    <main className="flex-1">
      <section className="container mx-auto px-4 py-4 sm:py-5 md:py-6">
        <div className="mx-auto max-w-5xl">
          <div className="max-w-2xl">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground sm:text-xs">
              Marketplace geography
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground sm:text-2xl md:text-[1.75rem]">
              Where Reswell orders flow
            </h1>
            <p className="mt-1 hidden text-sm leading-snug text-muted-foreground sm:block">
              Confirmed sales mapped from seller state to buyer state.
            </p>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 lg:grid-cols-4 lg:gap-3">
            <StatCard
              icon={Package}
              label="Mapped sales"
              value={data.totals.mappableSales.toLocaleString()}
              hint={`${data.totals.confirmedSales.toLocaleString()} confirmed`}
            />
            <StatCard
              icon={MapPin}
              label="States selling"
              value={data.totals.statesSelling.toLocaleString()}
              hint="Listing origins"
            />
            <StatCard
              icon={TrendingUp}
              label="Cross-state"
              value={data.totals.crossStateSales.toLocaleString()}
              hint={`${data.totals.statesBuying} buyer states`}
            />
            <StatCard
              icon={ArrowRight}
              label="Volume"
              value={formatGmv(data.totals.volumeUsd)}
              hint="Confirmed gross"
            />
          </div>

          <UsaSalesFlowMap data={data} className="mt-3 sm:mt-4" />

          {data.truncated ? (
            <p className="mt-2 text-[10px] text-muted-foreground sm:text-xs">
              Showing the most recent {data.totals.confirmedSales.toLocaleString()} confirmed sales.
            </p>
          ) : null}

          <p
            className="mt-3 text-center text-[10px] text-muted-foreground sm:mt-4 sm:text-xs"
            suppressHydrationWarning
          >
            Updated {formatDistanceToNow(parseISO(data.generatedAt), { addSuffix: true })} · New
            sales added after checkout
          </p>
        </div>
      </section>
    </main>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Package
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="rounded-xl border border-border/80 bg-card px-2.5 py-2 shadow-sm sm:rounded-2xl sm:px-3 sm:py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">
        <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
        {label}
      </div>
      <p className="mt-1 text-lg font-semibold tracking-tight text-foreground sm:mt-1.5 sm:text-xl">
        {value}
      </p>
      <p className="mt-0.5 truncate text-[10px] text-muted-foreground sm:text-xs">{hint}</p>
    </div>
  )
}
