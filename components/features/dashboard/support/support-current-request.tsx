import Link from "next/link"
import { ArrowRight, Plus } from "lucide-react"
import type { UserSupportCaseListItem } from "@/lib/types/supportCase"
import {
  formatSupportCaseReference,
  splitSupportCaseSubject,
  SUPPORT_CASE_STATUS_DESCRIPTION,
  SUPPORT_DESK_NAME,
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
  const unread = item.unreadCount > 0
  const waiting = !unread && item.status === "waiting_on_you"
  const { roleLabel, title } = splitSupportCaseSubject(item.subject)
  const heading = unread
    ? item.unreadCount === 1
      ? "New message from Reswell"
      : `${item.unreadCount} new messages from Reswell`
    : waiting
      ? "Reply needed"
      : "Open request"
  const actionLabel = unread ? "Read" : waiting ? "Reply" : "Open"
  const orderAlreadyInTitle = Boolean(item.orderRef && title.includes(item.orderRef))
  const meta = [
    formatSupportCaseReference(item.id),
    item.orderRef && !orderAlreadyInTitle ? `Order ${item.orderRef}` : null,
  ].filter(Boolean)

  return (
    <section aria-labelledby="support-current-heading">
      <Link
        href={item.href}
        className={cn(
          "mt-0 block rounded-2xl border p-5 shadow-sm transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-listingHeart focus-visible:ring-offset-2",
          unread
            ? "border-listingHeart/50 bg-listingHeart/[0.14] hover:border-listingHeart/70 hover:bg-listingHeart/[0.18]"
            : waiting
              ? "border-amber-300/80 bg-amber-50 hover:border-amber-400 hover:bg-amber-50/80 dark:border-amber-800/70 dark:bg-amber-950/40 dark:hover:bg-amber-950/55"
              : "border-listingHeart/30 bg-listingHeart/[0.08] hover:border-listingHeart/45 hover:bg-listingHeart/[0.12]",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p
              id="support-current-heading"
              className={cn(
                "flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]",
                unread
                  ? "text-listingHeart"
                  : waiting
                    ? "text-amber-800 dark:text-amber-200"
                    : "text-listingHeart",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  unread && "animate-pulse bg-red-500",
                  !unread && waiting && "bg-amber-600",
                  !unread && !waiting && "bg-listingHeart",
                )}
                aria-hidden
              />
              {heading}
            </p>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-[17px] font-semibold tracking-tight text-foreground">
              {roleLabel ? (
                <span
                  className={cn(
                    "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
                    waiting
                      ? "bg-amber-200/80 text-amber-950 dark:bg-amber-900/70 dark:text-amber-50"
                      : "bg-listingHeart/15 text-listingHeart",
                  )}
                >
                  {roleLabel}
                </span>
              ) : null}
              <span className="min-w-0 [overflow-wrap:anywhere]">{title}</span>
            </p>
          </div>
          <span className="flex shrink-0 flex-col items-end gap-1.5">
            {unread ? (
              <span className="inline-flex h-5 items-center rounded-full bg-red-500 px-1.5 text-[10px] font-semibold tabular-nums text-white">
                {item.unreadCount > 99 ? "99+" : item.unreadCount} new
              </span>
            ) : null}
            <span
              className={cn(
                "inline-flex h-8 items-center gap-1 rounded-full px-3 text-[13px] font-medium text-white",
                waiting ? "bg-amber-700 dark:bg-amber-600" : "bg-listingHeart",
              )}
            >
              {actionLabel}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </span>
          </span>
        </div>
        <div className="mt-2">
          {unread ? (
            <p className="text-[12px] font-medium text-listingHeart">{SUPPORT_DESK_NAME}</p>
          ) : null}
          <p
            className={cn(
              "line-clamp-2 text-[14px] leading-relaxed",
              unread ? "font-medium text-foreground" : "text-muted-foreground",
            )}
          >
            {requestPreview(item)}
          </p>
        </div>
        <p className="mt-3 text-[12px] text-muted-foreground">
          {meta.length > 0 ? (
            <>
              <span className="font-mono">{meta.join(" · ")}</span>
              <span className="mx-1.5 text-border">·</span>
            </>
          ) : null}
          Updated <LocalDateTime iso={item.updatedAt} dateStyle="medium" timeStyle="short" />
        </p>
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
