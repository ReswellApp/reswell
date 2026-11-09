"use client"

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Inbox,
  LayoutList,
  ShieldCheck,
  Sparkles,
  UserRound,
  UserX,
} from "lucide-react"
import type { CaseInboxView, InboxViewCounts } from "@/lib/admin/case-inbox"
import { cn } from "@/lib/utils"

export type { InboxViewCounts }

type ViewIcon = typeof Inbox

type InboxViewOption = {
  id: CaseInboxView
  label: string
  countKey: keyof InboxViewCounts
  icon: ViewIcon
}

type InboxViewSection = {
  label: string
  views: InboxViewOption[]
}

const VIEW_SECTIONS: InboxViewSection[] = [
  {
    label: "Your inbox",
    views: [
      { id: "open", label: "Open", countKey: "open", icon: Inbox },
      { id: "mine", label: "Assigned to me", countKey: "mine", icon: UserRound },
      { id: "unassigned", label: "Unassigned", countKey: "unassigned", icon: UserX },
    ],
  },
  {
    label: "Needs attention",
    views: [
      { id: "new", label: "New", countKey: "neu", icon: Sparkles },
      { id: "waiting", label: "Waiting", countKey: "waiting", icon: Clock3 },
      { id: "overdue", label: "Overdue", countKey: "overdue", icon: AlertTriangle },
      { id: "claims", label: "Claims", countKey: "claims", icon: ShieldCheck },
    ],
  },
  {
    label: "Browse",
    views: [
      { id: "all", label: "All", countKey: "all", icon: LayoutList },
      { id: "resolved", label: "Resolved", countKey: "resolved", icon: CheckCircle2 },
    ],
  },
]

const FLAT_VIEWS = VIEW_SECTIONS.flatMap((section) => section.views)

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
  if (compact) {
    return (
      <nav
        aria-label="Inbox views"
        className={cn(
          "flex flex-nowrap gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          className,
        )}
      >
        {FLAT_VIEWS.map((view) => {
          const count = counts[view.countKey]
          const selected = active === view.id
          return (
            <button
              key={view.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(view.id)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium transition-colors",
                selected
                  ? "bg-foreground text-background"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <span>{view.label}</span>
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

  return (
    <nav aria-label="Inbox views" className={cn("flex flex-col gap-4 p-2", className)}>
      {VIEW_SECTIONS.map((section) => (
        <div key={section.label} className="space-y-0.5">
          <p className="px-2 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {section.label}
          </p>
          {section.views.map((view) => {
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
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors",
                  selected
                    ? "bg-foreground text-background"
                    : "text-foreground hover:bg-muted/70",
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{view.label}</span>
                <span
                  className={cn(
                    "tabular-nums text-[11px]",
                    selected ? "text-background/70" : "text-muted-foreground",
                    view.id === "overdue" && count > 0 && !selected && "font-semibold text-destructive",
                    view.id === "unassigned" &&
                      count > 0 &&
                      !selected &&
                      "font-medium text-amber-700 dark:text-amber-300",
                  )}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      ))}
    </nav>
  )
}

export { FLAT_VIEWS as INBOX_VIEW_OPTIONS }
