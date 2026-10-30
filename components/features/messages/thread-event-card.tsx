"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { format, isToday, isYesterday } from "date-fns"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export type ThreadEventTone = "neutral" | "success" | "info" | "warning" | "accent"

export const THREAD_EVENT_CTA_CLASS =
  "h-9 w-full rounded-lg text-[13px] font-medium tracking-[-0.02em]"

const TONE_ICON: Record<ThreadEventTone, string> = {
  neutral: "bg-muted/80 text-foreground/70",
  success: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400",
  info: "bg-sky-500/12 text-sky-700 dark:text-sky-400",
  warning: "bg-amber-500/12 text-amber-800 dark:text-amber-400",
  accent: "bg-[#EBB847]/14 text-[#B88714] dark:text-[#EBB847]",
}

export function formatThreadEventTime(dateStr: string): string {
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return ""
  if (isToday(date)) return format(date, "h:mm a")
  if (isYesterday(date)) return `Yesterday ${format(date, "h:mm a")}`
  return format(date, "MMM d, h:mm a")
}

export function ThreadEventCard({
  icon: Icon,
  tone = "neutral",
  title,
  subtitle,
  amount,
  createdAt,
  children,
  className,
}: {
  icon: LucideIcon
  tone?: ThreadEventTone
  title: string
  subtitle?: string | null
  amount?: string | null
  createdAt?: string | null
  children?: ReactNode
  className?: string
}) {
  return (
    <article
      className={cn(
        "w-full max-w-[min(100%,20rem)] overflow-hidden rounded-2xl border-2 border-foreground bg-card text-foreground sm:max-w-[min(100%,22rem)]",
        className,
      )}
    >
      <div className="px-3.5 py-3.5">
        <div className="flex items-start gap-2.5">
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
              TONE_ICON[tone],
            )}
          >
            <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 text-[15px] font-semibold leading-snug tracking-[-0.02em]">
                {title}
              </p>
              {amount ? (
                <p className="shrink-0 text-[15px] font-semibold tabular-nums tracking-tight">
                  {amount}
                </p>
              ) : null}
            </div>
            {subtitle ? (
              <p className="mt-0.5 truncate text-[13px] leading-snug text-muted-foreground">
                {subtitle}
              </p>
            ) : null}
            {children ? <div className="mt-2.5 space-y-2.5">{children}</div> : null}
            {createdAt ? (
              <p
                className={cn(
                  "text-[11px] tabular-nums text-muted-foreground/80",
                  children ? "mt-2.5" : "mt-2",
                )}
              >
                {formatThreadEventTime(createdAt)}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  )
}

export function ThreadEventListings({ titles }: { titles: string[] }) {
  if (titles.length === 0) return null
  if (titles.length === 1) {
    return (
      <p className="line-clamp-2 text-[13px] leading-snug text-foreground/85">{titles[0]}</p>
    )
  }
  return (
    <ul className="space-y-1 text-[13px] leading-snug text-foreground/85">
      {titles.map((title, idx) => (
        <li key={`${title}-${idx}`} className="line-clamp-2">
          {title}
        </li>
      ))}
    </ul>
  )
}

export function ThreadEventHint({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <p className={cn("text-[13px] leading-snug text-muted-foreground", className)}>{children}</p>
  )
}

export function ThreadEventMeta({ children }: { children: ReactNode }) {
  return <div className="space-y-1.5">{children}</div>
}

export function ThreadEventMetaRow({
  icon: Icon,
  children,
}: {
  icon?: LucideIcon
  children: ReactNode
}) {
  return (
    <div className="flex items-start gap-2 text-[13px] leading-snug text-muted-foreground">
      {Icon ? (
        <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
      ) : null}
      <div className="min-w-0 text-foreground/85">{children}</div>
    </div>
  )
}

export function ThreadEventActions({ children }: { children: ReactNode }) {
  return <div className="space-y-2">{children}</div>
}

export function ThreadEventLink({
  href,
  children,
}: {
  href: string
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      className="text-[13px] font-medium text-foreground/80 underline decoration-foreground/20 underline-offset-2 transition-colors hover:text-foreground hover:decoration-foreground/45"
    >
      {children}
    </Link>
  )
}
