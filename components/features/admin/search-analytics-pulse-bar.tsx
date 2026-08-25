"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { format, parseISO } from "date-fns"
import { ChevronDown, Search } from "lucide-react"

import type { SearchAnalyticsPulse, SearchAnalyticsPulseEvent } from "@/lib/services/searchAnalytics"
import { BUSINESS_TIMEZONE_LABEL } from "@/lib/utils/business-timezone"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"

type PulseWindow = "today" | "week"

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value)
}

function formatOccurredAt(iso: string): string {
  try {
    return format(parseISO(iso), "MMM d, h:mm a")
  } catch {
    return iso
  }
}

function eventsForWindow(
  pulse: SearchAnalyticsPulse,
  window: PulseWindow,
): SearchAnalyticsPulseEvent[] {
  if (window === "today" && pulse.todayFrom) {
    return pulse.recentEvents.filter((row) => row.occurredAt >= pulse.todayFrom)
  }
  return pulse.recentEvents
}

interface SearchAnalyticsPulseBarProps {
  pulse: SearchAnalyticsPulse
}

export function SearchAnalyticsPulseBar({ pulse }: SearchAnalyticsPulseBarProps) {
  const [open, setOpen] = useState(false)
  const [pulseWindow, setPulseWindow] = useState<PulseWindow>("week")

  const events = useMemo(() => eventsForWindow(pulse, pulseWindow), [pulse, pulseWindow])
  const windowCount = pulseWindow === "today" ? pulse.todayCount : pulse.weekCount

  const openWindow = (next: PulseWindow) => {
    setPulseWindow(next)
    setOpen(true)
  }

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex items-baseline justify-between gap-3 px-0.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5574AD]">
            Marketplace searches
          </p>
          <p className="text-[11px] text-muted-foreground">{BUSINESS_TIMEZONE_LABEL}</p>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:max-w-md">
          <PulseTile
            label="Searches"
            footnote="Today"
            value={pulse.tracked ? formatCount(pulse.todayCount) : "—"}
            onClick={() => openWindow("today")}
            active={open && pulseWindow === "today"}
          />
          <PulseTile
            label="Searches"
            footnote="Past week"
            value={pulse.tracked ? formatCount(pulse.weekCount) : "—"}
            onClick={() => openWindow("week")}
            active={open && pulseWindow === "week"}
          />
        </div>
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-9 shrink-0 border-slate-200 bg-white"
          >
            View all searches
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[min(28rem,calc(100vw-2rem))] p-0">
          <div className="border-b border-slate-100 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">All searches</p>
              <p className="text-xs tabular-nums text-slate-500">
                {pulse.tracked ? `${formatCount(windowCount)} in window` : "Tracking off"}
              </p>
            </div>
            <div className="mt-2 flex gap-1.5">
              <WindowChip
                label="Today"
                active={pulseWindow === "today"}
                onClick={() => setPulseWindow("today")}
              />
              <WindowChip
                label="Past week"
                active={pulseWindow === "week"}
                onClick={() => setPulseWindow("week")}
              />
            </div>
          </div>
          <ScrollArea className="h-[min(22rem,50vh)]">
            {events.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-slate-500">
                {pulse.tracked
                  ? "No marketplace searches in this window yet."
                  : "Search tracking is off."}
              </p>
            ) : (
              <ul className="divide-y divide-slate-100" aria-label="Marketplace searches">
                {events.map((row) => (
                  <li key={row.id}>
                    <Link
                      href={`/search?q=${encodeURIComponent(row.query)}`}
                      className="flex flex-col gap-0.5 px-3 py-2.5 transition-colors hover:bg-slate-50"
                    >
                      <span className="truncate text-sm font-medium text-slate-900" title={row.query}>
                        {row.query}
                      </span>
                      <span className="flex items-center justify-between gap-3 text-xs text-slate-500">
                        <time dateTime={row.occurredAt}>{formatOccurredAt(row.occurredAt)}</time>
                        <span className="tabular-nums">
                          {row.resultCount.toLocaleString()}{" "}
                          {row.resultCount === 1 ? "result" : "results"}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
          {pulse.recentEventsCapped && pulseWindow === "week" ? (
            <p className="border-t border-slate-100 px-3 py-2 text-[11px] text-slate-500">
              Showing the latest {formatCount(pulse.recentEvents.length)} of{" "}
              {formatCount(pulse.weekCount)} searches this week.
            </p>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  )
}

function PulseTile({
  label,
  footnote,
  value,
  onClick,
  active,
}: {
  label: string
  footnote: string
  value: string
  onClick: () => void
  active: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex min-h-[6.25rem] flex-col justify-between rounded-2xl border bg-white px-3.5 py-3 text-left",
        "shadow-soft transition-all duration-200 ease-out",
        "hover:-translate-y-0.5 hover:border-[#5574AD]/25 hover:shadow-soft-hover",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5574AD] focus-visible:ring-offset-2",
        active ? "border-[#5574AD]/40" : "border-black/[0.05]",
      )}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#C45C3E] text-white shadow-sm">
        <Search className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-xl font-bold leading-none tabular-nums tracking-tight text-[#163060]">
          {value}
        </p>
        <p className="mt-1 text-[12px] font-semibold leading-snug text-[#163060]">{label}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{footnote}</p>
      </div>
    </button>
  )
}

function WindowChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
        active
          ? "bg-slate-900 text-white"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200",
      )}
    >
      {label}
    </button>
  )
}
