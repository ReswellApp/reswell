"use client"

import type { ReactNode } from "react"
import {
  ArrowRight,
  Check,
  ClipboardList,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Search,
  Store,
  Users,
  Wand2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { SearchDailyReportSnapshot } from "@/lib/services/searchDailyReport"
import type { SearchDailyLlmReport, SearchDailySynonymProposal } from "@/lib/validations/search-daily-report"

const OWNER_LABEL: Record<string, string> = {
  inventory: "Inventory",
  search: "Search",
  sellers: "Sellers",
  buyers: "Buyers",
  ops: "Ops",
}

const CAUSE_LABEL: Record<string, string> = {
  no_inventory: "No inventory",
  synonym_gap: "Synonym gap",
  typo_or_spelling: "Typo / spelling",
  wrong_category: "Wrong category",
  nl_parse_miss: "NL parse miss",
  unknown: "Unknown",
}

const PRIORITY_TINT: Record<string, string> = {
  high: "bg-rose-50 text-rose-700",
  medium: "bg-amber-50 text-amber-800",
  low: "bg-slate-100 text-slate-600",
}

function pct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—"
  return `${Math.round(n * 1000) / 10}%`
}

function KpiCard({
  label,
  value,
  subtitle,
}: {
  label: string
  value: string
  subtitle?: string
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1.5 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
      {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
    </div>
  )
}

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-slate-600">
          {icon}
        </span>
        {title}
      </h3>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function EmptyHint({ children }: { children: ReactNode }) {
  return <p className="text-sm text-slate-500">{children}</p>
}

function ActionList({ items }: { items: { finding: string; action: string }[] }) {
  if (items.length === 0) return <EmptyHint>Nothing flagged for this day.</EmptyHint>
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.finding} className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
          <p className="text-sm font-medium text-slate-900">{item.finding}</p>
          <p className="mt-1 text-sm text-slate-600">{item.action}</p>
        </li>
      ))}
    </ul>
  )
}

function proposalForQuery(
  proposals: SearchDailySynonymProposal[] | undefined,
  query: string,
): SearchDailySynonymProposal | undefined {
  const needle = query.trim().toLowerCase()
  return (proposals ?? []).find((row) => row.query.trim().toLowerCase() === needle)
}

function SynonymStatus({
  query,
  likelyCause,
  proposal,
  busy,
  onApply,
}: {
  query: string
  likelyCause: string
  proposal: SearchDailySynonymProposal | undefined
  busy: boolean
  onApply: (query: string) => void
}) {
  if (proposal?.applied) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
        <Check className="h-3.5 w-3.5" />
        Added
      </span>
    )
  }
  if (proposal?.skippedReason && !proposal.apply) {
    return <span className="text-xs text-slate-500">{proposal.skippedReason}</span>
  }
  const canTry =
    proposal?.apply === true ||
    likelyCause === "synonym_gap" ||
    likelyCause === "typo_or_spelling"
  if (!canTry && proposal?.skippedReason) {
    return <span className="text-xs text-slate-500">{proposal.skippedReason}</span>
  }
  if (!canTry) {
    return <span className="text-xs text-slate-400">—</span>
  }
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-7 px-2 text-xs"
      disabled={busy}
      onClick={() => onApply(query)}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
      <span className="ml-1">Add synonym</span>
    </Button>
  )
}

export function SearchDailyReportKpis({ snapshot }: { snapshot: SearchDailyReportSnapshot }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <KpiCard
        label="Searches"
        value={snapshot.totalSearches.toLocaleString()}
        subtitle={`${snapshot.uniqueQueriesApprox.toLocaleString()} unique queries`}
      />
      <KpiCard
        label="Empty results"
        value={snapshot.zeroResultEventCount.toLocaleString()}
        subtitle={pct(snapshot.zeroResultShare)}
      />
      <KpiCard
        label="Dropdown clicks"
        value={snapshot.dropdownClicks.toLocaleString()}
        subtitle={`${snapshot.navFreeFormSubmits.toLocaleString()} nav submits`}
      />
      <KpiCard
        label="Demand capture"
        value={snapshot.demandCaptureTotal.toLocaleString()}
        subtitle="Notify-me requests"
      />
    </div>
  )
}

export function SearchDailyReportBody({
  report,
  applyingQuery,
  onApplySynonym,
}: {
  report: SearchDailyLlmReport
  applyingQuery: string | null
  onApplySynonym: (query: string) => void
}) {
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Executive summary
        </h3>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
          {report.executiveSummary}
        </p>
      </section>

      {report.topActions.length > 0 ? (
        <SectionCard title="Top actions" icon={<ClipboardList className="h-4 w-4" />}>
          <ol className="space-y-3">
            {report.topActions.map((a, i) => (
              <li key={a.title} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{a.title}</p>
                  <p className="mt-0.5 text-sm text-slate-600">{a.why}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {OWNER_LABEL[a.owner] ?? a.owner} · {a.effort} effort
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </SectionCard>
      ) : null}

      {report.emptySearchFixes.length > 0 ? (
        <SectionCard title="Empty / no-result searches" icon={<Search className="h-4 w-4" />}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3 font-medium">Query</th>
                  <th className="py-2 pr-3 font-medium">Count</th>
                  <th className="py-2 pr-3 font-medium">Cause</th>
                  <th className="py-2 pr-3 font-medium">Inventory</th>
                  <th className="py-2 pr-3 font-medium">Search</th>
                  <th className="py-2 font-medium">Synonym</th>
                </tr>
              </thead>
              <tbody>
                {report.emptySearchFixes.map((row) => (
                  <tr key={`${row.query}-${row.searchCount}`} className="border-b border-slate-100 align-top">
                    <td className="py-2.5 pr-3 font-medium text-slate-900">“{row.query}”</td>
                    <td className="py-2.5 pr-3 tabular-nums text-slate-700">{row.searchCount}</td>
                    <td className="py-2.5 pr-3 text-slate-600">
                      {CAUSE_LABEL[row.likelyCause] ?? row.likelyCause}
                    </td>
                    <td className="py-2.5 pr-3 text-slate-600">{row.inventoryAction}</td>
                    <td className="py-2.5 pr-3 text-slate-600">{row.searchAction}</td>
                    <td className="py-2.5">
                      <SynonymStatus
                        query={row.query}
                        likelyCause={row.likelyCause}
                        proposal={proposalForQuery(report.synonymProposals, row.query)}
                        busy={applyingQuery === row.query}
                        onApply={onApplySynonym}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      ) : null}

      {(report.synonymProposals ?? []).length > 0 ? (
        <SectionCard title="Board synonyms" icon={<Wand2 className="h-4 w-4" />}>
          <ul className="space-y-3">
            {(report.synonymProposals ?? []).map((proposal) => (
              <li
                key={`${proposal.term}-${proposal.query}`}
                className="rounded-lg border border-slate-100 bg-slate-50/60 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">
                      “{proposal.term}” → {proposal.expansions.join(", ")}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">{proposal.reason}</p>
                  </div>
                  <SynonymStatus
                    query={proposal.query}
                    likelyCause={proposal.apply ? "synonym_gap" : "no_inventory"}
                    proposal={proposal}
                    busy={applyingQuery === proposal.query}
                    onApply={onApplySynonym}
                  />
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      {report.inventoryOpportunities.length > 0 ? (
        <SectionCard title="Inventory to source" icon={<Package className="h-4 w-4" />}>
          <ul className="space-y-3">
            {report.inventoryOpportunities.map((item) => (
              <li key={item.item} className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-slate-900">{item.item}</p>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
                      PRIORITY_TINT[item.priority] ?? PRIORITY_TINT.low,
                    )}
                  >
                    {item.priority}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{item.demandSignal}</p>
                <p className="mt-1 text-sm text-slate-700">{item.sellerPlay}</p>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      {report.demandThemes.length > 0 ? (
        <SectionCard title="Demand themes" icon={<Wand2 className="h-4 w-4" />}>
          <ul className="space-y-3">
            {report.demandThemes.map((t) => (
              <li key={t.theme} className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                <p className="text-sm font-medium text-slate-900">{t.theme}</p>
                <p className="mt-1 text-sm text-slate-600">{t.buyerIntent}</p>
                <p className="mt-1 text-xs text-slate-500">{t.evidence}</p>
                <p className="mt-2 text-sm text-slate-700">{t.recommendation}</p>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Dropdown / typeahead" icon={<ArrowRight className="h-4 w-4" />}>
          <ActionList items={report.dropdownInsights} />
        </SectionCard>
        <SectionCard title="Search quality" icon={<Search className="h-4 w-4" />}>
          <ActionList items={report.searchQuality} />
        </SectionCard>
        <SectionCard title="Seller opportunities" icon={<Store className="h-4 w-4" />}>
          <ActionList items={report.sellerOpportunities} />
        </SectionCard>
        <SectionCard title="Buyer experience" icon={<Users className="h-4 w-4" />}>
          <ActionList items={report.buyerExperience} />
        </SectionCard>
      </div>

      {report.recurringFromPriorDays.length > 0 ? (
        <SectionCard title="Recurring from prior days" icon={<RefreshCw className="h-4 w-4" />}>
          <ul className="space-y-3">
            {report.recurringFromPriorDays.map((r) => (
              <li key={r.theme} className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                <p className="text-sm font-medium text-slate-900">{r.theme}</p>
                <p className="mt-0.5 text-xs text-slate-500">Seen across {r.daysSeen} days</p>
                <p className="mt-1 text-sm text-slate-600">{r.nextStep}</p>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}
    </div>
  )
}
