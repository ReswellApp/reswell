"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { ChevronRight, LifeBuoy } from "lucide-react"
import type { ContactMessageUserRow } from "@/lib/db/contactMessages"
import {
  formatSupportTicketReference,
  isUserSupportTicketOpen,
  supportTicketDisplaySubject,
  USER_SUPPORT_STATUS_DESCRIPTION,
  USER_SUPPORT_STATUS_LABEL,
  userSupportStatusBadgeVariant,
} from "@/lib/utils/support-ticket-display"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { LocalDateTime } from "@/components/ui/local-datetime"

type SupportFilter = "all" | "open" | "resolved"

const FILTER_LABEL: Record<SupportFilter, string> = {
  all: "All",
  open: "Open",
  resolved: "Resolved",
}

interface SupportTicketsListProps {
  tickets: ContactMessageUserRow[]
  activeFilter: SupportFilter
  openCount: number
}

export function SupportTicketsList({ tickets, activeFilter, openCount }: SupportTicketsListProps) {
  const pathname = usePathname() ?? "/dashboard/support"
  const router = useRouter()
  const searchParams = useSearchParams()

  function setFilter(next: SupportFilter) {
    const q = new URLSearchParams(searchParams.toString())
    if (next === "all") {
      q.delete("status")
    } else {
      q.set("status", next)
    }
    const suffix = q.toString()
    router.replace(suffix ? `${pathname}?${suffix}` : pathname)
  }

  return (
    <div className="space-y-4">
      <Tabs value={activeFilter} onValueChange={(v) => setFilter(v as SupportFilter)}>
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1.5 p-1 sm:inline-flex sm:h-10 sm:w-auto">
          {(Object.keys(FILTER_LABEL) as SupportFilter[]).map((key) => (
            <TabsTrigger key={key} value={key} className="text-xs sm:text-sm">
              {FILTER_LABEL[key]}
              {key === "open" && openCount > 0 ? ` (${openCount})` : null}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {tickets.length === 0 ? (
        <Card className="rounded-xl border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <LifeBuoy className="mb-4 h-12 w-12 text-muted-foreground/70" />
            <p className="text-base font-medium text-foreground">
              {activeFilter === "open"
                ? "No open support requests"
                : activeFilter === "resolved"
                  ? "No resolved requests yet"
                  : "No support requests yet"}
            </p>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              {activeFilter === "all"
                ? "When you contact Reswell support, your requests and replies appear here."
                : "Try another filter or open a new request."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => {
            const subject = supportTicketDisplaySubject(ticket.subject, ticket.source)
            const isOpen = isUserSupportTicketOpen(ticket.support_status)
            return (
              <Link
                key={ticket.id}
                href={`/dashboard/support/${ticket.id}`}
                className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Card
                  className={cn(
                    "overflow-hidden transition-colors hover:border-primary/25 hover:bg-muted/30",
                    !isOpen && "opacity-90",
                  )}
                >
                  <CardContent className="flex items-start gap-4 p-4 sm:p-5">
                    <div className="hidden shrink-0 sm:flex sm:h-11 sm:w-11 sm:items-center sm:justify-center sm:rounded-full sm:bg-primary/10">
                      <LifeBuoy className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 space-y-1">
                          <p className="truncate text-[15px] font-semibold text-foreground">{subject}</p>
                          <p className="font-mono text-[11px] text-muted-foreground">
                            {formatSupportTicketReference(ticket.id)}
                          </p>
                        </div>
                        <Badge
                          variant={userSupportStatusBadgeVariant(ticket.support_status)}
                          className={cn(
                            "shrink-0 font-normal",
                            ticket.support_status === "resolved" &&
                              "border-transparent bg-muted text-muted-foreground",
                          )}
                        >
                          {USER_SUPPORT_STATUS_LABEL[ticket.support_status]}
                        </Badge>
                      </div>
                      <p className="line-clamp-2 text-sm text-muted-foreground">{ticket.message}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span title={ticket.updated_at}>
                          Updated{" "}
                          {formatDistanceToNow(new Date(ticket.updated_at), { addSuffix: true })}
                        </span>
                        <span className="hidden sm:inline" aria-hidden>
                          ·
                        </span>
                        <span className="hidden sm:inline">
                          Opened{" "}
                          <LocalDateTime iso={ticket.created_at} dateStyle="medium" />
                        </span>
                        {ticket.support_conversation_id ? (
                          <>
                            <span aria-hidden>·</span>
                            <span className="text-primary/80">Thread active</span>
                          </>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground/90">
                        {USER_SUPPORT_STATUS_DESCRIPTION[ticket.support_status]}
                      </p>
                    </div>
                    <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
