import Link from "next/link"
import { ArrowLeft, LifeBuoy, Package } from "lucide-react"
import {
  formatSupportCaseReference,
  isSupportCaseOpen,
  splitSupportCaseSubject,
  SUPPORT_CASE_STATUS_DESCRIPTION,
  SUPPORT_CASE_STATUS_LABEL,
  SUPPORT_DESK_NAME,
} from "@/lib/utils/support-case-display"
import { humanizeSupportCasePreview } from "@/lib/utils/humanize-support-case-preview"
import type { SupportCaseKind, SupportCaseStatus } from "@/lib/types/supportCase"
import type { SupportCaseThreadMessage } from "@/lib/services/supportCaseThread"
import { SupportCaseLiveRefresh } from "@/components/features/support/support-case-live-refresh"
import { SupportCaseThread } from "@/components/features/support/support-case-thread"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type SupportCaseResponseViewProps = {
  caseId: string
  subject: string
  kind: SupportCaseKind
  status: SupportCaseStatus
  preview: string
  orderId: string | null
  orderRef: string | null
  orderHref: string | null
  createdAt: string
  messages: SupportCaseThreadMessage[]
  repairCreditTotal?: number
  initialUnreadCount?: number
}

export function SupportCaseResponseView({
  caseId,
  subject,
  status,
  preview,
  createdAt,
  orderRef,
  orderHref,
  messages,
  repairCreditTotal = 0,
  initialUnreadCount = 0,
}: SupportCaseResponseViewProps) {
  const { title } = splitSupportCaseSubject(subject)
  const open = isSupportCaseOpen(status)
  const waiting = status === "waiting_on_you"
  const customerOpening =
    messages.find((message) => message.author_role === "customer" && !message.is_internal)
      ?.body ?? ""
  // Case preview tracks the latest snippet (often the staff reply) — only use it
  // before any customer message exists in the thread.
  const openingBody = humanizeSupportCasePreview(
    customerOpening || (messages.some((message) => message.author_role === "agent") ? "" : preview),
    12000,
  )
  const subtitleParts = [
    title,
    formatSupportCaseReference(caseId),
    orderRef && !title.includes(orderRef) ? `Order ${orderRef}` : null,
  ].filter(Boolean)

  return (
    <div className="mx-auto flex h-[min(100dvh,52rem)] min-h-0 w-full max-w-2xl flex-1 flex-col overflow-hidden border-border/60 bg-background sm:rounded-2xl sm:border sm:shadow-sm lg:my-4">
      <SupportCaseLiveRefresh initialUnreadCount={initialUnreadCount} />

      <header className="flex shrink-0 items-center gap-1 border-b border-border/60 bg-background px-1 py-2 sm:px-2">
        <Button asChild variant="ghost" size="icon" className="h-11 w-11 shrink-0 rounded-full">
          <Link href="/dashboard/support" aria-label="Back to Support">
            <ArrowLeft className="h-[22px] w-[22px]" strokeWidth={2} />
          </Link>
        </Button>

        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-listingHeart text-white"
          aria-hidden
        >
          <LifeBuoy className="h-5 w-5" strokeWidth={1.75} />
        </div>

        <div className="min-w-0 flex-1 px-2.5">
          <p className="truncate text-[15px] font-semibold text-foreground">{SUPPORT_DESK_NAME}</p>
          <p className="truncate text-[12px] text-muted-foreground">
            {subtitleParts.join(" · ")}
          </p>
        </div>

        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
            waiting
              ? "bg-amber-500/15 text-amber-800 dark:text-amber-200"
              : open
                ? "bg-listingHeart/12 text-listingHeart"
                : "bg-muted text-muted-foreground",
          )}
        >
          {SUPPORT_CASE_STATUS_LABEL[status]}
        </span>

        {orderHref ? (
          <Button asChild variant="ghost" size="icon" className="h-10 w-10 shrink-0 rounded-full">
            <Link href={orderHref} aria-label="View order">
              <Package className="h-4 w-4" />
            </Link>
          </Button>
        ) : null}
      </header>

      {waiting ? (
        <p className="shrink-0 border-b border-amber-200/70 bg-amber-50 px-4 py-2.5 text-center text-[13px] leading-snug text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-50 sm:px-3">
          {SUPPORT_CASE_STATUS_DESCRIPTION.waiting_on_you}
        </p>
      ) : null}

      {repairCreditTotal > 0 ? (
        <p className="shrink-0 border-b border-border/40 px-4 py-2 text-center text-[12px] text-muted-foreground sm:px-2">
          Repair credit ${repairCreditTotal.toFixed(2)} ·{" "}
          <Link href="/dashboard/wallet" className="underline underline-offset-2">
            Wallet
          </Link>
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <SupportCaseThread
          caseId={caseId}
          messages={messages}
          canReply
          role="member"
          closed={status === "resolved"}
          originalRequest={
            openingBody
              ? { body: openingBody, createdAt, name: "You" }
              : null
          }
        />
      </div>
    </div>
  )
}
