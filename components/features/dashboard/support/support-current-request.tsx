import Link from "next/link"
import { ArrowRight, Plus } from "lucide-react"
import type { UserSupportCaseListItem } from "@/lib/types/supportCase"
import {
  formatSupportCaseReference,
  SUPPORT_CASE_STATUS_DESCRIPTION,
  SUPPORT_CASE_STATUS_LABEL,
} from "@/lib/utils/support-case-display"
import { helpHubHref } from "@/lib/help/help-hub-intents"
import { Button } from "@/components/ui/button"
import { LocalDateTime } from "@/components/ui/local-datetime"
import { cn } from "@/lib/utils"

function requestPreview(item: UserSupportCaseListItem): string {
  if (item.preview.trim()) return item.preview
  if (item.orderRef) return `Order ${item.orderRef}`
  return SUPPORT_CASE_STATUS_DESCRIPTION[item.status]
}

export function SupportCurrentRequest({ item }: { item: UserSupportCaseListItem }) {
  const waiting = item.status === "waiting_on_you"
  const meta = [
    formatSupportCaseReference(item.id),
    item.orderRef ? `Order ${item.orderRef}` : null,
  ].filter(Boolean)

  return (
    <section aria-labelledby="support-current-heading">
      <h2
        id="support-current-heading"
        className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
      >
        Current request
      </h2>
      <Link
        href={item.href}
        className={cn(
          "mt-3 block rounded-2xl border bg-card p-5 shadow-sm transition-colors",
          "hover:border-listingHeart/35 hover:bg-listingHeart/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-listingHeart focus-visible:ring-offset-2",
          waiting ? "border-listingHeart/40" : "border-border/70",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 text-[17px] font-semibold tracking-tight text-foreground [overflow-wrap:anywhere]">
            {item.subject}
          </p>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
              item.unreadCount > 0 || waiting
                ? "bg-listingHeart text-white"
                : "bg-listingHeart/10 text-listingHeart",
            )}
          >
            {item.unreadCount > 0
              ? item.unreadCount === 1
                ? "New message"
                : `${item.unreadCount} new`
              : waiting
                ? "Reply needed"
                : SUPPORT_CASE_STATUS_LABEL[item.status]}
          </span>
        </div>
        {meta.length > 0 ? (
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">{meta.join(" · ")}</p>
        ) : null}
        <p className="mt-3 line-clamp-2 text-[14px] leading-relaxed text-muted-foreground">
          {requestPreview(item)}
        </p>
        <div className="mt-4 flex items-center justify-between gap-3 text-[13px]">
          <p className="text-muted-foreground">
            Updated <LocalDateTime iso={item.updatedAt} dateStyle="medium" timeStyle="short" />
          </p>
          <span className="inline-flex items-center gap-1 font-medium text-listingHeart">
            {waiting ? "Reply" : "Open"}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </span>
        </div>
      </Link>
    </section>
  )
}

export function SupportEmptyRequest() {
  return (
    <section
      aria-labelledby="support-empty-heading"
      className="rounded-2xl border border-dashed border-border/80 px-5 py-10 text-center"
    >
      <h2 id="support-empty-heading" className="text-[17px] font-semibold tracking-tight text-foreground">
        No open request
      </h2>
      <p className="mx-auto mt-2 max-w-[18rem] text-[14px] leading-relaxed text-muted-foreground">
        Ask us about an order, shipping, Purchase Protection, or your account.
      </p>
      <Button asChild className="mt-6 rounded-full px-5">
        <Link href={helpHubHref()}>
          <Plus className="mr-1.5 h-4 w-4" />
          Message Support
        </Link>
      </Button>
    </section>
  )
}
