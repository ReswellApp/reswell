import Link from "next/link"
import { ArrowLeft, LifeBuoy, Package } from "lucide-react"
import { ConversationThreadClient } from "@/components/features/messages/conversation-thread-client"
import type { ConversationThreadData } from "@/app/actions/messages"
import { formatSupportCaseReference } from "@/lib/utils/support-case-display"
import type { SupportCaseKind, SupportCaseStatus } from "@/lib/types/supportCase"
import { humanizeSupportCasePreview } from "@/lib/utils/humanize-support-case-preview"
import { Button } from "@/components/ui/button"
import { helpHubHref } from "@/lib/help/help-hub-intents"
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
  conversationId: string | null
  threadData: ConversationThreadData | null
  repairCreditTotal?: number
}

export function SupportCaseResponseView({
  caseId,
  subject,
  status,
  preview,
  orderRef,
  orderHref,
  conversationId,
  threadData,
  repairCreditTotal = 0,
}: SupportCaseResponseViewProps) {
  const hasThread = Boolean(conversationId && threadData)
  const cleanPreview = humanizeSupportCasePreview(preview, 320)
  const subtitleParts = [
    orderRef ? `Order ${orderRef}` : null,
    status === "waiting_on_you"
      ? "Waiting on you"
      : status === "resolved"
        ? "Closed"
        : null,
  ].filter(Boolean)

  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-2xl flex-col",
        hasThread
          ? "h-[min(calc(100dvh-8rem),720px)] min-h-[28rem]"
          : "gap-6 px-4 py-6 sm:px-0 sm:py-8",
      )}
    >
      <header
        className={cn(
          "flex shrink-0 items-center gap-1 border-b border-border/60 bg-background py-2",
          hasThread ? "px-1 sm:px-2" : "px-0",
        )}
      >
        <Button asChild variant="ghost" size="icon" className="h-11 w-11 shrink-0 rounded-full">
          <Link href="/dashboard/support" aria-label="Back to Support">
            <ArrowLeft className="h-[22px] w-[22px]" strokeWidth={2} />
          </Link>
        </Button>

        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background"
          aria-hidden
        >
          <LifeBuoy className="h-5 w-5" strokeWidth={1.75} />
        </div>

        <div className="min-w-0 flex-1 px-2.5">
          <p className="truncate text-[15px] font-semibold text-foreground">{subject}</p>
          <p className="truncate text-[12px] text-muted-foreground">
            {subtitleParts.length > 0 ? subtitleParts.join(" · ") : "Reswell Support"}
          </p>
        </div>

        {orderHref ? (
          <Button asChild variant="ghost" size="icon" className="h-10 w-10 shrink-0 rounded-full">
            <Link href={orderHref} aria-label="View order">
              <Package className="h-4 w-4" />
            </Link>
          </Button>
        ) : null}
      </header>

      {repairCreditTotal > 0 ? (
        <p className="shrink-0 border-b border-border/40 px-4 py-2 text-center text-[12px] text-muted-foreground sm:px-2">
          Repair credit ${repairCreditTotal.toFixed(2)} ·{" "}
          <Link href="/dashboard/wallet" className="underline underline-offset-2">
            Wallet
          </Link>
        </p>
      ) : null}

      {hasThread && conversationId && threadData ? (
        <div className="flex min-h-0 flex-1 flex-col px-0 sm:px-0">
            <ConversationThreadClient
              key={conversationId}
              conversationId={conversationId}
              initialData={threadData}
              embedded
              hideHeader
              backHref={`/support/${caseId}`}
            />
        </div>
      ) : (
        <section className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground"
            aria-hidden
          >
            <LifeBuoy className="h-6 w-6" strokeWidth={1.75} />
          </div>
          <p className="mt-5 text-[17px] font-medium text-foreground">We’re on it</p>
          <p className="mt-2 max-w-[18rem] text-[14px] leading-relaxed text-muted-foreground">
            You’ll be able to chat here once a teammate picks this up. We’ll also email you.
          </p>
          {cleanPreview ? (
            <p className="mt-6 max-w-md text-[14px] leading-relaxed text-foreground/90">
              “{cleanPreview}”
            </p>
          ) : null}
          <p className="mt-8 font-mono text-[11px] text-muted-foreground/70">
            {formatSupportCaseReference(caseId)}
          </p>
          <Button asChild variant="outline" size="sm" className="mt-6 rounded-full">
            <Link href={helpHubHref()}>Something else?</Link>
          </Button>
        </section>
      )}
    </div>
  )
}
