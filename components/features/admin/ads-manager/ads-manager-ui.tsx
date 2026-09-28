import { cn } from "@/lib/utils"
import type { AdVerdict } from "@/lib/types/adsManager"
import { verdictLabel } from "@/lib/ads/manager/format"

const VERDICT_CLASS: Record<AdVerdict, string> = {
  winner: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  loser: "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200",
  learning: "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  paused: "bg-muted text-muted-foreground",
  ok: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
}

export function AdsVerdictBadge({ verdict }: { verdict: AdVerdict }) {
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", VERDICT_CLASS[verdict])}>
      {verdictLabel(verdict)}
    </span>
  )
}

export function AdsField({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  )
}

export function platformLabel(platform: "google" | "meta"): string {
  return platform === "google" ? "Google Ads" : "Meta Ads"
}
