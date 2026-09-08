import Link from "next/link"
import { ArrowLeft, LifeBuoy, Package } from "lucide-react"
import { formatSupportCaseReference } from "@/lib/utils/support-case-display"
import type { SupportCaseKind, SupportCaseStatus } from "@/lib/types/supportCase"
import type { SupportCaseThreadMessage } from "@/lib/services/supportCaseThread"
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
}

export function SupportCaseResponseView({
  caseId,
  subject,
  status,
  orderRef,
  orderHref,
  messages,
  repairCreditTotal = 0,
}: SupportCaseResponseViewProps) {
  const subtitleParts = [
    formatSupportCaseReference(caseId),
    orderRef ? `Order ${orderRef}` : null,
  ].filter(Boolean)

  return (
    <div className="mx-auto flex h-[min(calc(100dvh-8rem),720px)] min-h-[28rem] w-full max-w-2xl flex-col">
      <header className="flex shrink-0 items-center gap-1 border-b border-border/60 bg-background px-1 py-2 sm:px-2">
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
            {subtitleParts.join(" · ")}
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

      <div className={cn("flex min-h-0 flex-1 flex-col px-1 sm:px-2")}>
        <SupportCaseThread
          caseId={caseId}
          messages={messages}
          canReply
          role="member"
          closed={status === "resolved"}
        />
      </div>
    </div>
  )
}
