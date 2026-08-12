import type { BusinessIntelligenceReportListItem } from "@/lib/types/businessIntelligence"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export function IntelligenceArchive({
  rows,
  activeId,
  onSelect,
}: {
  rows: BusinessIntelligenceReportListItem[]
  activeId: string | null
  onSelect: (row: BusinessIntelligenceReportListItem) => void
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-card px-5 py-10 text-center text-sm text-muted-foreground">
        Saved briefings will appear here after the first generate or nightly cron.
      </p>
    )
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
      {rows.map((row) => (
        <li key={row.id}>
          <button
            type="button"
            onClick={() => onSelect(row)}
            className={cn(
              "flex w-full flex-col gap-1 px-5 py-3 text-left hover:bg-muted/40",
              activeId === row.id && "bg-muted/60",
            )}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium capitalize">{row.period_kind}</span>
              <span className="text-sm tabular-nums text-muted-foreground">{row.period_key}</span>
              <Badge variant={row.status === "complete" ? "secondary" : "outline"}>
                {row.status}
              </Badge>
            </div>
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {row.executiveSummary ?? row.error ?? "No summary yet."}
            </p>
          </button>
        </li>
      ))}
    </ul>
  )
}
