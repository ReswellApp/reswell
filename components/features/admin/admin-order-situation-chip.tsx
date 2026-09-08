import { Badge } from "@/components/ui/badge"
import type { AdminOrderSituationTone } from "@/lib/admin-order-situation"
import { cn } from "@/lib/utils"

const TONE_CLASS: Record<AdminOrderSituationTone, string> = {
  neutral: "border-border text-muted-foreground",
  amber: "border-amber-500/40 text-amber-700 dark:text-amber-400",
  sky: "border-sky-500/40 text-sky-700 dark:text-sky-400",
  violet: "border-violet-500/40 text-violet-700 dark:text-violet-400",
  emerald: "border-emerald-500/40 text-emerald-700 dark:text-emerald-400",
  rose: "border-rose-500/40 text-rose-700 dark:text-rose-400",
}

export function AdminOrderSituationChip({
  label,
  tone,
  className,
}: {
  label: string
  tone: AdminOrderSituationTone
  className?: string
}) {
  return (
    <Badge variant="outline" className={cn("font-medium", TONE_CLASS[tone], className)}>
      {label}
    </Badge>
  )
}

export function adminOrderSituationSurfaceClass(tone: AdminOrderSituationTone): string {
  switch (tone) {
    case "amber":
      return "border-amber-500/25 bg-amber-500/[0.07]"
    case "sky":
      return "border-sky-500/25 bg-sky-500/[0.07]"
    case "violet":
      return "border-violet-500/25 bg-violet-500/[0.07]"
    case "emerald":
      return "border-emerald-500/25 bg-emerald-500/[0.07]"
    case "rose":
      return "border-rose-500/25 bg-rose-500/[0.07]"
    default:
      return "border-border bg-muted/40"
  }
}
