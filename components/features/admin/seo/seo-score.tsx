"use client"

import { AlertCircle, CheckCircle2, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { SeoIssue, SeoScoreResult } from "./seo-scoring"

const ICON: Record<SeoIssue["level"], typeof CheckCircle2> = {
  good: CheckCircle2,
  warn: AlertTriangle,
  error: AlertCircle,
}

const ICON_CLASS: Record<SeoIssue["level"], string> = {
  good: "text-emerald-600",
  warn: "text-amber-600",
  error: "text-destructive",
}

function ringColor(score: number): string {
  if (score >= 90) return "text-emerald-600"
  if (score >= 75) return "text-lime-600"
  if (score >= 55) return "text-amber-600"
  return "text-destructive"
}

export function SeoScore({ result }: { result: SeoScoreResult }) {
  const { score, grade, issues } = result
  const circumference = 2 * Math.PI * 26
  const dash = (score / 100) * circumference

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative h-16 w-16 shrink-0">
          <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
            <circle cx="32" cy="32" r="26" fill="none" strokeWidth="6" className="stroke-secondary" />
            <circle
              cx="32"
              cy="32"
              r="26"
              fill="none"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circumference}`}
              className={cn("transition-all", ringColor(score))}
              stroke="currentColor"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-bold leading-none text-foreground">{score}</span>
            <span className="text-[10px] text-muted-foreground">/ 100</span>
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">SEO health</p>
          <p className="text-xs text-muted-foreground">Grade {grade}</p>
        </div>
      </div>
      <ul className="space-y-1.5">
        {issues.map((issue, i) => {
          const Icon = ICON[issue.level]
          return (
            <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
              <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", ICON_CLASS[issue.level])} aria-hidden />
              <span>{issue.message}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
