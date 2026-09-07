"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { formatDistanceToNowStrict } from "date-fns"
import { LifeBuoy, Plus } from "lucide-react"
import type { UserSupportCaseListItem } from "@/lib/types/supportCase"
import { isSupportCaseOpen, SUPPORT_CASE_STATUS_LABEL } from "@/lib/utils/support-case-display"
import { helpHubHref } from "@/lib/help/help-hub-intents"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type SupportFilter = "all" | "open" | "resolved"

interface SupportCasesListProps {
  cases: UserSupportCaseListItem[]
  activeFilter: SupportFilter
  openCount: number
}

function shortRelative(iso: string): string {
  try {
    return formatDistanceToNowStrict(new Date(iso), { addSuffix: false })
      .replace(/ seconds?/, "s")
      .replace(/ minutes?/, "m")
      .replace(/ hours?/, "h")
      .replace(/ days?/, "d")
      .replace(/ months?/, "mo")
      .replace(/ years?/, "y")
  } catch {
    return ""
  }
}

function SupportAvatar({ muted }: { muted?: boolean }) {
  return (
    <div
      className={cn(
        "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
        muted ? "bg-muted text-muted-foreground" : "bg-foreground text-background",
      )}
      aria-hidden
    >
      <LifeBuoy className="h-5 w-5" strokeWidth={1.75} />
    </div>
  )
}

export function SupportCasesList({ cases, activeFilter }: SupportCasesListProps) {
  const pathname = usePathname() ?? "/dashboard/support"
  const router = useRouter()
  const searchParams = useSearchParams()

  function setFilter(next: SupportFilter) {
    const q = new URLSearchParams(searchParams.toString())
    if (next === "open") {
      q.delete("status")
    } else {
      q.set("status", next)
    }
    const suffix = q.toString()
    router.replace(suffix ? `${pathname}?${suffix}` : pathname)
  }

  if (cases.length === 0) {
    return (
      <div className="flex flex-col items-center px-2 py-20 text-center">
        <SupportAvatar />
        <p className="mt-5 text-[17px] font-medium text-foreground">
          {activeFilter === "resolved" ? "No closed chats" : "No messages yet"}
        </p>
        <p className="mt-2 max-w-[16rem] text-[14px] leading-relaxed text-muted-foreground">
          {activeFilter === "resolved"
            ? "When a chat is closed, it will land here."
            : "Ask us about orders, shipping, Purchase Protection, or your account."}
        </p>
        {activeFilter === "resolved" ? (
          <button
            type="button"
            onClick={() => setFilter("open")}
            className="mt-6 text-sm font-medium text-foreground underline-offset-4 hover:underline"
          >
            Back to open
          </button>
        ) : (
          <Button asChild className="mt-6 rounded-full px-5">
            <Link href={helpHubHref()}>
              <Plus className="mr-1.5 h-4 w-4" />
              Message Support
            </Link>
          </Button>
        )}
      </div>
    )
  }

  return (
    <div>
      <ul className="divide-y divide-border/40">
        {cases.map((item) => {
          const open = isSupportCaseOpen(item.status)
          const waiting = item.status === "waiting_on_you"
          const line =
            item.preview ||
            (item.orderRef ? `Order ${item.orderRef}` : "Tap to open conversation")

          return (
            <li key={`${item.backend}-${item.id}`}>
              <Link
                href={item.href}
                className="flex items-center gap-3 py-3.5 transition-colors hover:bg-muted/40 sm:-mx-2 sm:rounded-xl sm:px-2"
              >
                <SupportAvatar muted={!open} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p
                      className={cn(
                        "truncate text-[15px] text-foreground",
                        waiting || open ? "font-semibold" : "font-medium",
                      )}
                    >
                      {item.subject}
                    </p>
                    <time
                      className="shrink-0 text-[11px] tabular-nums text-muted-foreground"
                      dateTime={item.updatedAt}
                    >
                      {shortRelative(item.updatedAt)}
                    </time>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <p
                      className={cn(
                        "min-w-0 flex-1 truncate text-[13px] text-muted-foreground",
                        waiting && "font-medium text-foreground",
                      )}
                    >
                      {waiting
                        ? `Reply needed · ${line}`
                        : `${SUPPORT_CASE_STATUS_LABEL[item.status]} · ${line}`}
                    </p>
                    {waiting ? (
                      <span
                        className="h-2 w-2 shrink-0 rounded-full bg-foreground"
                        aria-label="Needs reply"
                      />
                    ) : null}
                  </div>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>

      <div className="mt-8 text-center text-[13px] text-muted-foreground">
        {activeFilter === "resolved" ? (
          <button
            type="button"
            onClick={() => setFilter("open")}
            className="hover:text-foreground"
          >
            ← Open chats
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setFilter("resolved")}
            className="hover:text-foreground"
          >
            View closed
          </button>
        )}
      </div>
    </div>
  )
}
