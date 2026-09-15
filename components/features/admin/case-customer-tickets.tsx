import Link from "next/link"
import { format } from "date-fns"
import { Loader2 } from "lucide-react"
import type { SupportCaseCustomerTicket } from "@/lib/services/supportCaseCustomerContext"
import { SUPPORT_CASE_KIND_LABEL, SUPPORT_CASE_STATUS_LABEL } from "@/lib/utils/support-case-display"
import { adminSupportCaseHref } from "@/lib/utils/support-case-paths"
import type { SupportCaseKind, SupportCaseStatus } from "@/lib/types/supportCase"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface CaseCustomerTicketsProps {
  tickets: SupportCaseCustomerTicket[]
  total: number
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
}

function kindLabel(kind: string): string {
  return kind in SUPPORT_CASE_KIND_LABEL
    ? SUPPORT_CASE_KIND_LABEL[kind as SupportCaseKind]
    : kind.replaceAll("_", " ")
}

function statusLabel(status: string): string {
  return status in SUPPORT_CASE_STATUS_LABEL
    ? SUPPORT_CASE_STATUS_LABEL[status as SupportCaseStatus]
    : status.replaceAll("_", " ")
}

export function CaseCustomerTickets({
  tickets,
  total,
  hasMore,
  loadingMore,
  onLoadMore,
}: CaseCustomerTicketsProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Past tickets
        </p>
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {total} total
        </span>
      </div>
      {tickets.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/70 px-3 py-3 text-xs text-muted-foreground">
          No other tickets for this email.
        </p>
      ) : (
        <div className="divide-y divide-border/50 rounded-lg border border-border/60 bg-background">
          {tickets.map((ticket) => (
            <Link
              key={ticket.id}
              href={adminSupportCaseHref(ticket.id)}
              className="flex items-start justify-between gap-2 px-3 py-2 text-xs hover:bg-muted/40"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{ticket.subject}</span>
                <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                  {kindLabel(ticket.kind)}
                  {ticket.orderRef ? ` · #${ticket.orderRef}` : ""}
                  {" · "}
                  {format(new Date(ticket.updatedAt), "MMM d, yyyy")}
                </span>
              </span>
              <Badge variant="outline" className="h-5 shrink-0 font-normal capitalize">
                {statusLabel(ticket.status)}
              </Badge>
            </Link>
          ))}
        </div>
      )}
      {hasMore ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-full text-[11px]"
          disabled={loadingMore}
          onClick={onLoadMore}
        >
          {loadingMore ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" aria-hidden /> : null}
          Load more tickets
        </Button>
      ) : null}
    </div>
  )
}
