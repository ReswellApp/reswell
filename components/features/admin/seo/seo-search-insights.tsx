"use client"

import { useState } from "react"
import { BarChart3, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface PerformanceData {
  configured: true
  clicks: number
  impressions: number
  ctr: number
  position: number
  topQueries: { query: string; clicks: number; impressions: number; position: number }[]
  rangeDays: number
}
type ApiData = PerformanceData | { configured: false; reason: string }

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card px-2.5 py-2 text-center">
      <p className="text-base font-bold leading-none tabular-nums text-foreground">{value}</p>
      <p className="mt-1 text-[10px] text-muted-foreground">{label}</p>
    </div>
  )
}

/** On-demand Google Search Console performance for the selected page. */
export function SeoSearchInsights({ pageKey }: { pageKey: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle")
  const [data, setData] = useState<ApiData | null>(null)

  async function load() {
    setState("loading")
    try {
      const res = await fetch("/api/admin/page-seo/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageKey }),
      })
      const body = await res.json().catch(() => ({}))
      setData((body?.data as ApiData) ?? { configured: false, reason: "No data." })
    } catch {
      setData({ configured: false, reason: "Could not load Search Console data." })
    } finally {
      setState("done")
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Search Console
        </p>
        <Button variant="ghost" size="sm" onClick={load} disabled={state === "loading"}>
          {state === "loading" ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <BarChart3 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          )}
          {state === "done" ? "Refresh" : "Load data"}
        </Button>
      </div>

      {data?.configured ? (
        <div className="space-y-2">
          <div className="grid grid-cols-4 gap-1.5">
            <Metric label="Clicks" value={data.clicks.toLocaleString()} />
            <Metric label="Impr." value={data.impressions.toLocaleString()} />
            <Metric label="CTR" value={`${(data.ctr * 100).toFixed(1)}%`} />
            <Metric label="Avg pos" value={data.position.toFixed(1)} />
          </div>
          {data.topQueries.length > 0 ? (
            <div className="rounded-md border border-border">
              <p className="border-b border-border px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Top queries · last {data.rangeDays} days
              </p>
              <ul className="divide-y divide-border">
                {data.topQueries.map((q) => (
                  <li key={q.query} className="flex items-center justify-between gap-2 px-2.5 py-1.5">
                    <span className="min-w-0 truncate text-xs text-foreground">{q.query}</span>
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                      {q.clicks} clk · #{q.position.toFixed(0)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">No impressions yet for this page.</p>
          )}
        </div>
      ) : data && !data.configured ? (
        <p className="rounded-md border border-dashed border-border px-3 py-3 text-[11px] text-muted-foreground">
          {data.reason} Set <code className="text-foreground/70">GOOGLE_SEARCH_CONSOLE_SITE_URL</code> and{" "}
          <code className="text-foreground/70">GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT_JSON</code> to see
          clicks, impressions, and ranking queries here.
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Load real clicks, impressions, CTR, and ranking queries for this page.
        </p>
      )}
    </div>
  )
}
