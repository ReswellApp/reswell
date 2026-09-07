import type { ReactNode } from "react"
import type { BusinessIntelligenceReportRow } from "@/lib/types/businessIntelligence"
import { compactUsd, formatCount, formatPct } from "@/components/features/admin/intelligence-format"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const OWNER_LABEL: Record<string, string> = {
  growth: "Growth",
  marketplace: "Marketplace",
  search: "Search",
  ops: "Ops",
  ads: "Ads",
  product: "Product",
  sellers: "Sellers",
}

export function IntelligenceReportView({ row }: { row: BusinessIntelligenceReportRow }) {
  const report = row.report
  const snap = row.snapshot
  if (row.status !== "complete" || !report) {
    return (
      <div className="rounded-2xl border border-border bg-card px-5 py-10 text-center text-sm text-muted-foreground">
        {row.status === "failed"
          ? row.error || "This briefing failed to generate."
          : row.status === "generating"
            ? "Generating this briefing…"
            : "No briefing saved for this period yet."}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {snap.periodLabel} · vs {snap.compareLabel}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-foreground">{report.executiveSummary}</p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{report.periodRecap}</p>
      </div>

      {snap.commerce ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <MiniStat label="GMV" value={compactUsd(snap.commerce.gmv.current)} />
          <MiniStat label="Revenue" value={compactUsd(snap.commerce.platformRevenue.current)} />
          <MiniStat
            label="Promo"
            value={compactUsd(snap.commerce.marketingExpense?.current ?? 0)}
          />
          <MiniStat label="Orders" value={formatCount(snap.commerce.orders.current)} />
          <MiniStat
            label="New users"
            value={formatCount(snap.growth?.newUsers.current ?? 0)}
          />
        </div>
      ) : null}

      {report.kpiCommentary.length > 0 ? (
        <Section title="KPI commentary">
          <ul className="space-y-2">
            {report.kpiCommentary.map((item) => (
              <li key={item.metric} className="text-sm">
                <span className="font-medium">{item.metric}.</span>{" "}
                <span className="text-muted-foreground">{item.takeaway}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title="Projections">
        <p className="mb-3 text-xs text-muted-foreground">
          Confidence {report.projections.confidence}
          {snap.runRate?.momGmvDeltaPct != null
            ? ` · MoM GMV ${formatPct(snap.runRate.momGmvDeltaPct)}`
            : ""}
        </p>
        <div className="grid gap-3 md:grid-cols-3">
          <ProjectionCard label="Next 7 days" window={report.projections.next7Days} />
          <ProjectionCard label="Next 30 days" window={report.projections.next30Days} />
          <ProjectionCard label="Next 90 days" window={report.projections.next90Days} />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{report.projections.caveats}</p>
      </Section>

      {report.recommendations.length > 0 ? (
        <Section title="Recommendations">
          <ol className="space-y-3">
            {report.recommendations.map((item, index) => (
              <li key={item.title} className="rounded-xl border border-border/80 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs tabular-nums text-muted-foreground">{index + 1}</span>
                  <p className="font-medium">{item.title}</p>
                  <Badge variant="secondary">{OWNER_LABEL[item.owner] ?? item.owner}</Badge>
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {item.impact} impact · {item.effort} effort
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{item.why}</p>
                <p className="mt-1 text-sm">{item.action}</p>
              </li>
            ))}
          </ol>
        </Section>
      ) : null}

      {report.opportunities.length > 0 ? (
        <Section title="Opportunities">
          <ul className="space-y-2">
            {report.opportunities.map((item) => (
              <li key={item.opportunity} className="text-sm">
                <span className="font-medium">{item.opportunity}.</span>{" "}
                <span className="text-muted-foreground">{item.evidence}</span>{" "}
                <span>{item.nextStep}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {report.risks.length > 0 ? (
        <Section title="Risks">
          <ul className="space-y-2">
            {report.risks.map((item) => (
              <li key={item.risk} className="text-sm">
                <span className="font-medium">{item.risk}.</span>{" "}
                <span className="text-muted-foreground">{item.signal}</span>{" "}
                <span>{item.mitigation}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {report.watchNextPeriod.length > 0 ? (
        <Section title="Watch next period">
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {report.watchNextPeriod.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      {snap.mostClickedUrl ? (
        <p className="text-xs text-muted-foreground">
          Most clicked URL this period:{" "}
          <span className="font-medium text-foreground">{snap.mostClickedUrl.path}</span> (
          {formatCount(snap.mostClickedUrl.views)} views)
        </p>
      ) : null}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="mb-3 font-headline text-base font-semibold">{title}</h3>
      {children}
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function ProjectionCard({
  label,
  window,
}: {
  label: string
  window: { gmv: string; orders: string; users: string; rationale: string }
}) {
  return (
    <div className={cn("rounded-xl border border-border/80 p-3")}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium">GMV {window.gmv}</p>
      <p className="text-xs text-muted-foreground">
        Orders {window.orders} · Users {window.users}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">{window.rationale}</p>
    </div>
  )
}
