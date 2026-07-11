"use client"

import { useMemo, useState } from "react"
import { formatDistanceToNow, parseISO } from "date-fns"
import { ArrowRight, MapPin, Package, TrendingUp } from "lucide-react"
import type { MarketplaceSalesMapPayload } from "@/lib/types/marketplace-sales-map"
import { formatGmv } from "@/lib/format-gmv"
import { cn } from "@/lib/utils"
import { usStateDisplayName } from "@/lib/utils/us-state-names"

type HoverTarget =
  | { kind: "state"; state: string }
  | { kind: "flow"; sellerState: string; buyerState: string }
  | null

function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount)
}

type UsaSalesFlowMapProps = {
  data: MarketplaceSalesMapPayload
  className?: string
}

export function UsaSalesFlowMap({ data, className }: UsaSalesFlowMapProps) {
  const [hover, setHover] = useState<HoverTarget>(null)
  const { geometry } = data

  const stateStatsByCode = useMemo(() => {
    return new Map(data.stateStats.map((row) => [row.state, row]))
  }, [data.stateStats])

  const maxStateActivity = useMemo(() => {
    return Math.max(
      1,
      ...data.stateStats.map((row) => row.asSeller + row.asBuyer),
    )
  }, [data.stateStats])

  const hoverLabel = useMemo(() => {
    if (!hover) return null
    if (hover.kind === "state") {
      const stat = stateStatsByCode.get(hover.state)
      if (!stat) {
        return {
          title: usStateDisplayName(hover.state),
          lines: ["No mapped sales in this state yet."],
        }
      }
      return {
        title: stat.stateName,
        lines: [
          `${stat.asSeller} sold from here`,
          `${stat.asBuyer} bought here`,
          `${formatUsd(stat.volumeUsd)} volume`,
        ],
      }
    }

    const flow = data.flows.find(
      (row) => row.sellerState === hover.sellerState && row.buyerState === hover.buyerState,
    )
    if (!flow) return null
    return {
      title: `${usStateDisplayName(flow.sellerState)} → ${usStateDisplayName(flow.buyerState)}`,
      lines: [
        `${flow.count} order${flow.count === 1 ? "" : "s"}`,
        `${formatUsd(flow.volumeUsd)} volume`,
      ],
    }
  }, [hover, stateStatsByCode, data.flows])

  return (
    <div className={cn("relative", className)}>
      <div className="overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-b from-muted/30 via-background to-background shadow-sm">
        <div className="relative aspect-[16/10] w-full min-h-[320px] sm:min-h-[420px] lg:min-h-[520px]">
          <svg
            viewBox={`0 0 ${geometry.width} ${geometry.height}`}
            className="h-full w-full"
            role="img"
            aria-label="United States map showing Reswell sales flowing from seller states to buyer states"
          >
            <defs>
              <linearGradient id="map-surface" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="hsl(var(--background))" />
                <stop offset="100%" stopColor="hsl(var(--muted) / 0.35)" />
              </linearGradient>
              <marker
                id="flow-arrow"
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

            <rect width={geometry.width} height={geometry.height} fill="url(#map-surface)" />

            {geometry.statePaths.map((state) => {
              const stat = stateStatsByCode.get(state.code)
              const activity = stat ? stat.asSeller + stat.asBuyer : 0
              const intensity = activity / maxStateActivity
              const fill = stat
                ? `rgba(15, 23, 42, ${0.04 + intensity * 0.22})`
                : "rgba(148, 163, 184, 0.08)"
              const isHovered =
                hover?.kind === "state" && hover.state === state.code

              return (
                <path
                  key={state.code}
                  d={state.d}
                  fill={fill}
                  stroke={isHovered ? "#0f172a" : "rgba(148, 163, 184, 0.45)"}
                  strokeWidth={isHovered ? 1.4 : 0.7}
                  className="transition-[fill,stroke,stroke-width] duration-200"
                  onMouseEnter={() => setHover({ kind: "state", state: state.code })}
                  onMouseLeave={() => setHover(null)}
                />
              )
            })}

            {geometry.flowPaths.map((flow) => {
              const isHovered =
                hover?.kind === "flow" &&
                hover.sellerState === flow.sellerState &&
                hover.buyerState === flow.buyerState

              return (
                <path
                  key={`${flow.sellerState}-${flow.buyerState}`}
                  d={flow.d}
                  fill="none"
                  stroke="#dc2626"
                  strokeWidth={isHovered ? flow.width + 1.2 : flow.width}
                  strokeOpacity={isHovered ? 0.95 : flow.opacity}
                  markerEnd="url(#flow-arrow)"
                  className="transition-[stroke-width,stroke-opacity] duration-200"
                  onMouseEnter={() =>
                    setHover({
                      kind: "flow",
                      sellerState: flow.sellerState,
                      buyerState: flow.buyerState,
                    })
                  }
                  onMouseLeave={() => setHover(null)}
                />
              )
            })}

            {geometry.stateDots.map((dot) => {
              const isHovered = hover?.kind === "state" && hover.state === dot.code

              return (
                <circle
                  key={`dot-${dot.code}`}
                  cx={dot.cx}
                  cy={dot.cy}
                  r={isHovered ? dot.radius + 1.5 : dot.radius}
                  fill={dot.fill}
                  fillOpacity={isHovered ? 0.95 : 0.72}
                  stroke="white"
                  strokeWidth={1.2}
                  className="pointer-events-none"
                />
              )
            })}
          </svg>

          {hoverLabel ? (
            <div className="pointer-events-none absolute left-4 top-4 max-w-xs rounded-xl border border-border/80 bg-background/95 px-4 py-3 shadow-lg backdrop-blur-sm">
              <p className="text-sm font-semibold text-foreground">{hoverLabel.title}</p>
              <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                {hoverLabel.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="pointer-events-none absolute bottom-4 left-4 rounded-xl border border-border/70 bg-background/90 px-3 py-2 text-xs text-muted-foreground shadow-sm backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-6 rounded-full bg-[#dc2626]/70" />
                Seller → buyer flow
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-foreground/80" />
                Listed here
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#dc2626]" />
                Bought here
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

type SalesMapPageClientProps = {
  data: MarketplaceSalesMapPayload
}

export function SalesMapPageClient({ data }: SalesMapPageClientProps) {
  const topFlows = data.flows
    .filter((flow) => flow.sellerState !== flow.buyerState)
    .slice(0, 8)

  return (
    <main className="flex-1">
      <section className="border-b border-border bg-background">
        <div className="container mx-auto py-8 md:py-10">
          <div className="max-w-3xl">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Marketplace geography
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              Where Reswell orders flow
            </h1>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              Every confirmed sale on Reswell, mapped from the seller&apos;s listing state to the
              buyer&apos;s state. Lines show cross-state movement; dots highlight active buying and
              selling regions.
            </p>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={Package}
              label="Mapped sales"
              value={data.totals.mappableSales.toLocaleString()}
              hint={`${data.totals.confirmedSales.toLocaleString()} confirmed total`}
            />
            <StatCard
              icon={MapPin}
              label="States selling"
              value={data.totals.statesSelling.toLocaleString()}
              hint="Where listings sold from"
            />
            <StatCard
              icon={TrendingUp}
              label="Cross-state trades"
              value={data.totals.crossStateSales.toLocaleString()}
              hint={`${data.totals.statesBuying} buyer states`}
            />
            <StatCard
              icon={ArrowRight}
              label="Marketplace volume"
              value={formatGmv(data.totals.volumeUsd)}
              hint="Confirmed order gross"
            />
          </div>
        </div>
      </section>

      <section className="container mx-auto py-6 md:py-8">
        <UsaSalesFlowMap data={data} />

        {data.truncated ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Showing the most recent {data.totals.confirmedSales.toLocaleString()} confirmed sales.
            Older orders are included in totals when within the fetch window.
          </p>
        ) : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-foreground">Top cross-state routes</h2>
              <span className="text-xs text-muted-foreground">Seller → buyer</span>
            </div>
            {topFlows.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Cross-state routes will appear as more sales complete with location data.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {topFlows.map((flow) => (
                  <li
                    key={`${flow.sellerState}-${flow.buyerState}`}
                    className="flex items-center justify-between gap-4 rounded-xl border border-border/60 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {usStateDisplayName(flow.sellerState)}
                        <span className="mx-2 text-muted-foreground">→</span>
                        {usStateDisplayName(flow.buyerState)}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {flow.count} order{flow.count === 1 ? "" : "s"} · {formatUsd(flow.volumeUsd)}
                      </p>
                    </div>
                    <div
                      className="h-2 flex-shrink-0 rounded-full bg-[#dc2626]"
                      style={{
                        width: `${Math.max(24, (flow.count / (topFlows[0]?.count ?? 1)) * 96)}px`,
                        opacity: 0.35 + (flow.count / (topFlows[0]?.count ?? 1)) * 0.65,
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-foreground">Recent mapped sales</h2>
              <span className="text-xs text-muted-foreground">State-level only</span>
            </div>
            <ul className="mt-4 max-h-[28rem] space-y-3 overflow-y-auto pr-1">
              {data.recentSales.map((sale) => (
                <li
                  key={sale.id}
                  className="rounded-xl border border-border/60 px-4 py-3"
                >
                  <p className="truncate text-sm font-medium text-foreground">
                    {sale.listingTitle?.trim() || "Marketplace sale"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {usStateDisplayName(sale.sellerState)}
                    <span className="mx-1.5 text-foreground/50">→</span>
                    {usStateDisplayName(sale.buyerState)}
                    <span className="mx-1.5">·</span>
                    {formatUsd(sale.amountUsd)}
                  </p>
                  <p
                    className="mt-1 text-[11px] text-muted-foreground/80"
                    suppressHydrationWarning
                  >
                    {formatDistanceToNow(parseISO(sale.soldAt), { addSuffix: true })}
                    {sale.fulfillmentMethod ? ` · ${sale.fulfillmentMethod}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground" suppressHydrationWarning>
          Updated {formatDistanceToNow(parseISO(data.generatedAt), { addSuffix: true })}. New sales
          are added automatically after checkout completes.
        </p>
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
    <div className="rounded-2xl border border-border/80 bg-card px-4 py-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}
