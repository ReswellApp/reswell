"use client"

import { useCallback } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import { SearchDailyReportAdminClient } from "@/components/features/admin/search-daily-report-admin-client"
import { SearchPeriodReportPanel } from "@/components/features/admin/search-period-report-panel"

const VIEWS = [
  { id: "daily", label: "Daily" },
  { id: "month", label: "Monthly" },
  { id: "all", label: "All time" },
] as const

type ReportView = (typeof VIEWS)[number]["id"]

function parseView(raw: string | null): ReportView {
  if (raw === "month" || raw === "all") return raw
  return "daily"
}

export function SearchReportAdminShell() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const view = parseView(searchParams.get("view"))

  const setView = useCallback(
    (next: ReportView) => {
      const params = new URLSearchParams()
      if (next !== "daily") params.set("view", next)
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router],
  )

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
        {VIEWS.map((item) => {
          const selected = view === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                selected
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900",
              )}
            >
              {item.label}
            </button>
          )
        })}
      </div>
      {view === "daily" ? <SearchDailyReportAdminClient /> : null}
      {view === "month" ? <SearchPeriodReportPanel kind="month" /> : null}
      {view === "all" ? <SearchPeriodReportPanel kind="all_time" /> : null}
    </div>
  )
}
