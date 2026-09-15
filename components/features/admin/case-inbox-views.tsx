"use client"

import { CheckCircle2, Inbox } from "lucide-react"
import type { CaseInboxView, InboxViewCounts } from "@/lib/admin/case-inbox"
import { cn } from "@/lib/utils"

export type { InboxViewCounts }

const VIEWS: {
  id: Extract<CaseInboxView, "open" | "resolved">
  label: string
  countKey: keyof InboxViewCounts
  icon: typeof Inbox
}[] = [
  { id: "open", label: "Open", countKey: "open", icon: Inbox },
  { id: "resolved", label: "Resolved", countKey: "resolved", icon: CheckCircle2 },
]

interface CaseInboxViewsProps {
  active: CaseInboxView
  counts: InboxViewCounts
  onChange: (view: CaseInboxView) => void
  className?: string
  compact?: boolean
}

export function CaseInboxViews({
  active,
  counts,
  onChange,
  className,
  compact = false,
}: CaseInboxViewsProps) {
  return (
    <nav
      aria-label="Inbox views"
      className={cn(
        compact
          ? "flex flex-nowrap gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          : "flex flex-col gap-0.5 p-2",
        className,
      )}
    >
      {compact ? null : (
        <p className="px-2 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Inbox
        </p>
      )}
      {VIEWS.map((view) => {
        const Icon = view.icon
        const count = counts[view.countKey]
        const selected = active === view.id
        return (
          <button
            key={view.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(view.id)}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors",
              compact && "shrink-0 py-1 text-[12px]",
              selected
                ? "bg-foreground text-background"
                : "text-foreground hover:bg-muted/70",
            )}
          >
            {compact ? null : <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />}
            <span className="min-w-0 flex-1 truncate">{view.label}</span>
            <span
              className={cn(
                "tabular-nums text-[11px]",
                selected ? "text-background/70" : "text-muted-foreground",
              )}
            >
              {count}
            </span>
          </button>
        )
      })}
    </nav>
  )
}

export { VIEWS as INBOX_VIEW_OPTIONS }
