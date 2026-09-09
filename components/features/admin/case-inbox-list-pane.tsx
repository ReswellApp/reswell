"use client"

import { formatDistanceToNow } from "date-fns"
import { Inbox, Loader2, Search, ShieldCheck, Sparkles } from "lucide-react"
import {
  inboxInitials,
  inboxPreviewSnippet,
  type CaseInboxItem,
  type CaseInboxTypeFilter,
  type CaseInboxView,
} from "@/lib/admin/case-inbox"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const TYPE_OPTIONS: { id: CaseInboxTypeFilter; label: string }[] = [
  { id: "all", label: "All types" },
  { id: "general", label: "General" },
  { id: "order", label: "Orders" },
]

function KindDot({ item }: { item: CaseInboxItem }) {
  const color = !item.isOpen
    ? "bg-muted-foreground/35"
    : item.slaState === "overdue"
      ? "bg-destructive"
      : item.isNew
        ? "bg-sky-500"
        : item.kind === "protection_claim" || item.kind === "safety"
          ? "bg-rose-500"
          : "bg-amber-500"
  return <span className={cn("mt-2 h-2 w-2 shrink-0 rounded-full", color)} aria-hidden />
}

interface CaseInboxListPaneProps {
  items: CaseInboxItem[]
  view: CaseInboxView
  selectedKey: string | null
  search: string
  typeFilter: CaseInboxTypeFilter
  showTypeFilter: boolean
  loading: boolean
  emptyLabel: string
  onSearch: (value: string) => void
  onTypeFilter: (value: CaseInboxTypeFilter) => void
  onSelect: (key: string) => void
}

export function CaseInboxListPane({
  items,
  view,
  selectedKey,
  search,
  typeFilter,
  showTypeFilter,
  loading,
  emptyLabel,
  onSearch,
  onTypeFilter,
  onSelect,
}: CaseInboxListPaneProps) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 space-y-2 border-b border-border/50 px-3 py-2.5">
        {view === "new" || view === "claims" ? (
          <div className="flex gap-2 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-2">
            {view === "claims" ? (
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-hidden />
            ) : (
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" aria-hidden />
            )}
            <div>
              <p className="text-xs font-semibold">
                {view === "claims" ? "Claims command queue" : "New request triage"}
              </p>
              <p className="text-[11px] leading-4 text-muted-foreground">
                {view === "claims"
                  ? "Review evidence, carrier state, and financial resolution."
                  : "Classify, prioritize, and assign every new conversation."}
              </p>
            </div>
          </div>
        ) : null}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search name, email, order…"
            className="h-8 border-border/60 bg-muted/20 pl-8 text-sm"
            aria-label="Search conversations"
          />
        </div>
        {showTypeFilter ? (
          <div className="flex flex-wrap gap-1">
            {TYPE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => onTypeFilter(option.id)}
                className={cn(
                  "rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                  typeFilter === option.id
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm">Loading inbox…</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-20 text-center text-muted-foreground">
            <Inbox className="h-8 w-8 opacity-40" />
            <p className="text-sm">{emptyLabel}</p>
          </div>
        ) : (
          <ul role="list" className="divide-y divide-border/40">
            {items.map((item) => {
              const active = item.key === selectedKey
              return (
                <li key={item.key}>
                  <button
                    type="button"
                    onClick={() => onSelect(item.key)}
                    className={cn(
                      "flex w-full gap-2.5 px-3 py-2.5 text-left transition-colors",
                      active ? "bg-muted" : "hover:bg-muted/40",
                    )}
                  >
                    <KindDot item={item} />
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                        item.isNew
                          ? "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-100"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {inboxInitials(item.fromName)}
                    </span>
                    <span className="min-w-0 flex-1 space-y-0.5">
                      <span className="flex items-start justify-between gap-2">
                        <span
                          className={cn(
                            "truncate text-[13px] text-foreground",
                            item.isNew ? "font-semibold" : "font-medium",
                          )}
                        >
                          {item.fromName}
                        </span>
                        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                          {formatDistanceToNow(new Date(item.updatedAt), { addSuffix: false })}
                        </span>
                      </span>
                      <span className="line-clamp-1 text-[12px] text-foreground/80">{item.subject}</span>
                      <span className="line-clamp-1 text-[12px] text-muted-foreground">
                        {inboxPreviewSnippet(item.preview)}
                      </span>
                      <span className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[10px] text-muted-foreground">
                        <span>{item.kindLabel}</span>
                        {item.orderRef ? <span>#{item.orderRef}</span> : null}
                        {item.priority !== "normal" ? (
                          <span
                            className={cn(
                              "rounded px-1 py-0.5 font-semibold uppercase tracking-wide",
                              item.priority === "urgent"
                                ? "bg-destructive/10 text-destructive"
                                : item.priority === "high"
                                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                                  : "bg-muted text-muted-foreground",
                            )}
                          >
                            {item.priority}
                          </span>
                        ) : null}
                        {item.kind === "protection_claim" && item.order?.carrier_claim_status ? (
                          <span className="rounded bg-rose-500/10 px-1 py-0.5 text-rose-700 dark:text-rose-300">
                            Claim {item.order.carrier_claim_status.replaceAll("_", " ")}
                          </span>
                        ) : null}
                        {item.slaLabel ? (
                          <span
                            className={cn(
                              item.slaState === "overdue"
                                ? "font-medium text-destructive"
                                : item.slaState === "due_soon"
                                  ? "text-amber-700 dark:text-amber-300"
                                  : null,
                            )}
                          >
                            {item.slaLabel}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
