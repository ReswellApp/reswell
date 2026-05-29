"use client"

import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import type { SeoHealthSummary } from "./seo-scoring"

function ringColor(score: number): string {
  if (score >= 90) return "text-emerald-600"
  if (score >= 75) return "text-lime-600"
  if (score >= 55) return "text-amber-600"
  return "text-destructive"
}

interface SeoHealthOverviewProps {
  summary: SeoHealthSummary
  onSelectPage: (key: string) => void
}

function Stat({ value, label, tone }: { value: number; label: string; tone?: "warn" | "danger" }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <p
        className={cn(
          "text-xl font-bold leading-none tabular-nums",
          tone === "danger" && value > 0 ? "text-destructive" : tone === "warn" && value > 0 ? "text-amber-600" : "text-foreground",
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-[11px] leading-tight text-muted-foreground">{label}</p>
    </div>
  )
}

export function SeoHealthOverview({ summary, onSelectPage }: SeoHealthOverviewProps) {
  const { score, grade } = summary
  const radius = 34
  const circumference = 2 * Math.PI * radius
  const dash = (score / 100) * circumference

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
        <div className="flex items-center gap-4">
          <div className="relative h-20 w-20 shrink-0">
            <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
              <circle cx="40" cy="40" r={radius} fill="none" strokeWidth="7" className="stroke-secondary" />
              <circle
                cx="40"
                cy="40"
                r={radius}
                fill="none"
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={`${dash} ${circumference}`}
                className={cn("transition-all", ringColor(score))}
                stroke="currentColor"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold leading-none text-foreground">{score}</span>
              <span className="text-[10px] text-muted-foreground">/ 100</span>
            </div>
          </div>
          <div>
            <p className="text-base font-semibold text-foreground">Overall SEO health</p>
            <p className="text-xs text-muted-foreground">
              Grade {grade} · averaged across {summary.pageCount} pages
            </p>
          </div>
        </div>

        <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat value={summary.needsAttention} label="Pages need attention" tone="warn" />
          <Stat value={summary.missingDescription} label="Missing description" tone="danger" />
          <Stat value={summary.missingShareImage} label="No share image" tone="warn" />
          <Stat value={summary.noindex} label="Set to no-index" tone="danger" />
        </div>
      </div>

      {summary.weakestPages.length > 0 ? (
        <div className="mt-4 border-t border-border pt-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Lowest scoring pages
          </p>
          <div className="flex flex-wrap gap-2">
            {summary.weakestPages.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => onSelectPage(p.key)}
                className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-3 py-1 text-xs text-foreground transition-colors hover:bg-secondary"
              >
                <span className={cn("font-semibold tabular-nums", ringColor(p.score))}>{p.score}</span>
                <span className="text-muted-foreground group-hover:text-foreground">{p.label}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" aria-hidden />
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
