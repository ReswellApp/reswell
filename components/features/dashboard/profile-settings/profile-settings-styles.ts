import { cn } from "@/lib/utils"

export const profileInputClass =
  "h-11 rounded-lg border-neutral-200 bg-white shadow-none focus-visible:border-primary/40 focus-visible:ring-primary/15"

export const profileTextareaClass =
  "min-h-[100px] rounded-lg border-neutral-200 bg-white shadow-none focus-visible:border-primary/40 focus-visible:ring-primary/15"

export const profileLabelClass = "text-sm font-semibold text-foreground"

export const profileSectionTitleClass = "text-[15px] font-semibold tracking-tight text-foreground"

export const profileSectionHintClass = "text-sm text-muted-foreground"

export const profileCardClass =
  "rounded-xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(17,17,17,0.04)]"

export function profilePillButtonClass(disabled?: boolean) {
  return cn(
    "h-11 w-full rounded-full text-[15px] font-semibold",
    disabled ? "bg-neutral-300 text-white hover:bg-neutral-300" : "",
  )
}

export const profileToggleRowClass =
  "flex items-start justify-between gap-4 border-b border-neutral-200/80 py-4 last:border-b-0"
