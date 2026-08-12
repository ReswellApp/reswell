"use client"

import { useMemo, useState } from "react"
import { Brain, Loader2, RefreshCw } from "lucide-react"

import { IntelligenceArchive } from "@/components/features/admin/intelligence-archive"
import { IntelligenceCharts } from "@/components/features/admin/intelligence-charts"
import { IntelligenceKpiGrid } from "@/components/features/admin/intelligence-kpi-grid"
import { IntelligenceReportView } from "@/components/features/admin/intelligence-report-view"
import { IntelligenceTrafficPanel } from "@/components/features/admin/intelligence-traffic-panel"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { IntelligenceLiveDashboard } from "@/lib/services/businessIntelligence"
import type {
  BusinessIntelligenceReportListItem,
  BusinessIntelligenceReportRow,
} from "@/lib/types/businessIntelligence"
import type { BusinessIntelligencePeriodKind } from "@/lib/validations/businessIntelligence"

export function IntelligenceAdminClient({ initial }: { initial: IntelligenceLiveDashboard }) {
  const [dashboard, setDashboard] = useState(initial)
  const [archiveRow, setArchiveRow] = useState<BusinessIntelligenceReportRow | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingKind, setPendingKind] = useState<BusinessIntelligencePeriodKind | null>(null)

  const generating = pendingKind != null

  async function generate(kind: BusinessIntelligencePeriodKind, force: boolean) {
    setError(null)
    setPendingKind(kind)
    try {
      const res = await fetch("/api/admin/intelligence/reports", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, force }),
      })
      const body = (await res.json().catch(() => ({}))) as {
        data?: BusinessIntelligenceReportRow
        error?: string
      }
      if (!res.ok || !body.data) {
        setError(typeof body.error === "string" ? body.error : "Could not generate the briefing.")
        return
      }
      const report = body.data
      setDashboard((prev) => ({
        ...prev,
        latest: { ...prev.latest, [kind]: report },
        archive: upsertArchive(prev.archive, report),
      }))
      setArchiveRow(report)
    } catch {
      setError("Could not generate the briefing.")
    } finally {
      setPendingKind(null)
    }
  }

  async function openArchive(item: BusinessIntelligenceReportListItem) {
    setError(null)
    const cached =
      dashboard.latest.daily?.id === item.id
        ? dashboard.latest.daily
        : dashboard.latest.weekly?.id === item.id
          ? dashboard.latest.weekly
          : dashboard.latest.monthly?.id === item.id
            ? dashboard.latest.monthly
            : archiveRow?.id === item.id
              ? archiveRow
              : null
    if (cached) {
      setArchiveRow(cached)
      return
    }
    const params = new URLSearchParams({ kind: item.period_kind, periodKey: item.period_key })
    const res = await fetch(`/api/admin/intelligence/reports?${params}`, { credentials: "include" })
    const body = (await res.json().catch(() => ({}))) as {
      data?: BusinessIntelligenceReportRow | null
      error?: string
    }
    if (!res.ok) {
      setError(typeof body.error === "string" ? body.error : "Could not open that briefing.")
      return
    }
    setArchiveRow(body.data ?? null)
  }

  const emptyHint = useMemo(() => {
    if (dashboard.llmEnabled) return null
    return "Set AI_GATEWAY_API_KEY (or deploy with Vercel OIDC) to generate Gemini briefings."
  }, [dashboard.llmEnabled])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Brain className="h-6 w-6" aria-hidden />
            Intelligence
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Daily briefing first, then live GMV, users, listings, orders, and top URLs. Weekly and
            monthly reports stay below.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <GenerateButton
            label="Weekly"
            kind="weekly"
            pendingKind={pendingKind}
            generating={generating}
            onGenerate={generate}
          />
          <GenerateButton
            label="Monthly"
            kind="monthly"
            pendingKind={pendingKind}
            generating={generating}
            onGenerate={generate}
          />
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </p>
      ) : null}
      {emptyHint ? <p className="text-sm text-muted-foreground">{emptyHint}</p> : null}
      {dashboard.insightsError ? (
        <p className="text-sm text-muted-foreground">{dashboard.insightsError}</p>
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Daily briefing</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Yesterday in Pacific time. A cron generates this every 24 hours at 15:00 UTC.
            </p>
          </div>
          <GenerateButton
            label="Daily"
            kind="daily"
            pendingKind={pendingKind}
            generating={generating}
            onGenerate={generate}
          />
        </div>
        <BriefingOrEmpty row={dashboard.latest.daily} kind="daily" />
      </section>

      {dashboard.insights ? <IntelligenceKpiGrid insights={dashboard.insights} /> : null}

      {dashboard.insights ? (
        <IntelligenceCharts
          daily={dashboard.insights.daily}
          periodLabel={dashboard.insights.periodLabel}
          monthly={dashboard.monthlyRevenue}
        />
      ) : null}

      <IntelligenceTrafficPanel pages={dashboard.topPages} source={dashboard.topPagesSource} />

      <Tabs defaultValue="weekly">
        <TabsList>
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
          <TabsTrigger value="archive">Saved reports</TabsTrigger>
        </TabsList>
        <TabsContent value="weekly" className="mt-4">
          <BriefingOrEmpty row={dashboard.latest.weekly} kind="weekly" />
        </TabsContent>
        <TabsContent value="monthly" className="mt-4">
          <BriefingOrEmpty row={dashboard.latest.monthly} kind="monthly" />
        </TabsContent>
        <TabsContent value="archive" className="mt-4 space-y-4">
          <IntelligenceArchive
            rows={dashboard.archive}
            activeId={archiveRow?.id ?? null}
            onSelect={(item) => void openArchive(item)}
          />
          {archiveRow ? <IntelligenceReportView row={archiveRow} /> : null}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function BriefingOrEmpty({
  row,
  kind,
}: {
  row: BusinessIntelligenceReportRow | null
  kind: BusinessIntelligencePeriodKind
}) {
  if (!row) {
    return (
      <p className="rounded-2xl border border-border bg-card px-5 py-10 text-center text-sm text-muted-foreground">
        No saved {kind} briefing yet. Generate one to store it in the database.
      </p>
    )
  }
  return <IntelligenceReportView row={row} />
}

function GenerateButton({
  label,
  kind,
  pendingKind,
  generating,
  onGenerate,
}: {
  label: string
  kind: BusinessIntelligencePeriodKind
  pendingKind: BusinessIntelligencePeriodKind | null
  generating: boolean
  onGenerate: (kind: BusinessIntelligencePeriodKind, force: boolean) => void
}) {
  const busy = generating && pendingKind === kind
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={generating}
      aria-label={`Generate ${label.toLowerCase()} briefing`}
      onClick={() => onGenerate(kind, true)}
    >
      {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
      {label}
    </Button>
  )
}

function upsertArchive(
  rows: BusinessIntelligenceReportListItem[],
  report: BusinessIntelligenceReportRow,
): BusinessIntelligenceReportListItem[] {
  const item: BusinessIntelligenceReportListItem = {
    id: report.id,
    period_kind: report.period_kind,
    period_key: report.period_key,
    period_start: report.period_start,
    period_end: report.period_end,
    generated_at: report.generated_at,
    model: report.model,
    status: report.status,
    error: report.error,
    executiveSummary: report.report?.executiveSummary ?? null,
  }
  const without = rows.filter(
    (row) => !(row.period_kind === item.period_kind && row.period_key === item.period_key),
  )
  return [item, ...without]
}
